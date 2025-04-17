<?php
/**
 * Plugin Name: Semester Schema Bootstrap
 * Description: A plugin to display a semester schedule using Bootstrap tables.
 * Version: 1.3
 * Author: oskedi02
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

// Enqueue JavaScript and CSS
function semester_schema_bootstrap_enqueue_scripts() {
    wp_enqueue_style(
        'bootstrap-css',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
        array(),
        '5.3.0'
    );
    wp_enqueue_script(
        'bootstrap-js',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
        array(),
        '5.3.0',
        true
    );
    wp_enqueue_script(
        'semester-schema-bootstrap-js',
        plugin_dir_url(__FILE__) . 'assets/js/semester-schema-bootstrap.js',
        array('jquery'),
        '1.0',
        true
    );
    wp_localize_script('semester-schema-bootstrap-js', 'SemesterSchemaSettings', array(
        'restUrl' => rest_url('semester-schema/v1/'),
        'nonce' => wp_create_nonce('wp_rest'),
        'currentYear' => date("Y") // Pass current year to JavaScript
    ));
}
add_action('wp_enqueue_scripts', 'semester_schema_bootstrap_enqueue_scripts');

// Register REST API routes
function semester_schema_register_routes() {
    register_rest_route('semester-schema/v1', '/load', array(
        'methods' => 'GET',
        'callback' => 'semester_schema_load_data',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('semester-schema/v1', '/personer', array(
        'methods' => 'GET',
        'callback' => 'semester_schema_load_personer',
        'permission_callback' => '__return_true'
    ));
    register_rest_route('semester-schema/v1', '/save', array(
        'methods' => 'POST',
        'callback' => 'semester_schema_save_data',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        }
    ));
    register_rest_route('semester-schema/v1', '/grupper', array(
        'methods' => 'GET',
        'callback' => 'hämta_grupper',
        'permission_callback' => '__return_true'
    ));
}
add_action('rest_api_init', 'semester_schema_register_routes');

// Load schedule data from the database
function semester_schema_load_data() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'semester_schema';

    $results = $wpdb->get_results("SELECT * FROM $table_name", ARRAY_A);

    $data = array();
    foreach ($results as $row) {
        $person = $row['person'];
        $datum = $row['datum'];
        $status = $row['status'];

        if (!isset($data[$person])) {
            $data[$person] = array();
        }
        $data[$person][$datum] = $status;
    }

    return $data;
}

// Load WordPress users
function semester_schema_load_personer() {
    global $wpdb;

    // Fetch users and avoid duplicates
    $results = $wpdb->get_results("
        SELECT u.ID AS user_id, 
               u.display_name, 
               u.user_login, 
               u.user_email, 
               g.group_name
        FROM {$wpdb->prefix}users u
        LEFT JOIN {$wpdb->prefix}user_groups g 
        ON u.ID = g.user_id
    ");

    // Map the results to the necessary structure
    return array_map(function($user) {
        return array(
            'id' => intval($user->user_id),
            'name' => $user->display_name ?: $user->user_login ?: 'Okänd användare',
            'email' => $user->user_email,
            'group' => $user->group_name ?: 'Ingen grupp'
        );
    }, $results);
}

// Save schedule data to the database
function semester_schema_save_data(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'semester_schema';

    $person = $request->get_param('person');
    $datum = $request->get_param('datum');
    $status = $request->get_param('status');

    if (empty($person) || empty($datum)) {
        return new WP_Error('invalid_data', 'Person and date are required.', array('status' => 400));
    }

    $existing = $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM $table_name WHERE person = %s AND datum = %s", $person, $datum)
    );

    if ($existing) {
        $wpdb->update(
            $table_name,
            array('status' => $status),
            array('person' => $person, 'datum' => $datum),
            array('%s'),
            array('%s', '%s')
        );
    } else {
        $wpdb->insert(
            $table_name,
            array(
                'person' => $person,
                'datum' => $datum,
                'status' => $status
            ),
            array('%s', '%s', '%s')
        );
    }

    return array(
        'success' => true,
        'message' => 'Data saved successfully for ' . esc_html($person),
        'person' => $person,
        'datum' => $datum,
        'status' => $status
    );
}

// Create tables on plugin activation
function semester_schema_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // Create semester_schema table
    $table_name = $wpdb->prefix . 'semester_schema';
    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        person VARCHAR(255) NOT NULL,
        datum DATE NOT NULL,
        status VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY person_datum_unique (person, datum)
    ) $charset_collate;";

    // Create user_groups table
    $group_table_name = $wpdb->prefix . 'user_groups';
    $sql .= "CREATE TABLE $group_table_name (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT(20) UNSIGNED NOT NULL,
        group_name VARCHAR(255) NOT NULL,
        UNIQUE KEY user_id (user_id), -- Ensure unique user_id per group
        FOREIGN KEY (user_id) REFERENCES {$wpdb->prefix}users(ID)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'semester_schema_create_tables');

// REST API callback for retrieving groups
function hämta_grupper() {
    global $wpdb;

    $results = $wpdb->get_results("
        SELECT u.display_name AS userName, g.group_name AS groupName
        FROM {$wpdb->prefix}users u
        LEFT JOIN {$wpdb->prefix}user_groups g ON u.ID = g.user_id
    ");

    return $results ? rest_ensure_response($results) : [];
}

// Add admin menu for group management
function semester_schema_add_admin_menu() {
    add_options_page(
        'Semester Schema',
        'Semester Schema',
        'manage_options',
        'semester-schema',
        'semester_schema_admin_page'
    );
}
add_action('admin_menu', 'semester_schema_add_admin_menu');

// Admin page for managing user groups
function semester_schema_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_groups_nonce']) && wp_verify_nonce($_POST['user_groups_nonce'], 'save_user_groups')) {
        foreach ($_POST['user_group'] as $user_id => $group_name) {
            global $wpdb;

            // Check if the user already has a group
            $existing = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}user_groups WHERE user_id = %d",
                    $user_id
                )
            );

            if ($existing) {
                // Update the group if it exists
                $wpdb->update(
                    $wpdb->prefix . 'user_groups',
                    array('group_name' => sanitize_text_field($group_name)),
                    array('user_id' => intval($user_id)),
                    array('%s'),
                    array('%d')
                );
            } else {
                // Insert a new group if it doesn't exist
                $wpdb->insert(
                    $wpdb->prefix . 'user_groups',
                    array(
                        'user_id' => intval($user_id),
                        'group_name' => sanitize_text_field($group_name)
                    ),
                    array('%d', '%s')
                );
            }
        }
        echo '<div class="updated"><p>Grupper sparade!</p></div>';
    }

    global $wpdb;
    $users = $wpdb->get_results("
        SELECT u.ID AS user_id, 
               u.display_name, 
               g.group_name 
        FROM {$wpdb->prefix}users u
        LEFT JOIN {$wpdb->prefix}user_groups g 
        ON u.ID = g.user_id
    ");

    $groups = ['IT-Support', 'IT-Drift', 'IT-Nät', 'IT-Stab', 'LGR'];

    ?>
    <div class="wrap">
        <h1>Semester Schema - Hantera Grupper</h1>
        <form method="post">
            <?php wp_nonce_field('save_user_groups', 'user_groups_nonce'); ?>
            <table class="widefat fixed">
                <thead>
                    <tr>
                        <th>Användare</th>
                        <th>Grupp</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $user): ?>
                        <tr>
                            <td><?php echo esc_html($user->display_name); ?></td>
                            <td>
                                <select name="user_group[<?php echo intval($user->user_id); ?>]">
                                    <option value="">Ingen grupp</option>
                                    <?php foreach ($groups as $group): ?>
                                        <option value="<?php echo esc_attr($group); ?>" <?php selected($user->group_name, $group); ?>>
                                            <?php echo esc_html($group); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php submit_button('Spara ändringar'); ?>
        </form>
    </div>
    <?php
}

// Shortcode to display the schedule
function semester_schema_bootstrap_shortcode($atts) {
    return '<div id="semester-schema-bootstrap-container" class="table-responsive"></div>';
}
add_shortcode('semester_schema_bootstrap', 'semester_schema_bootstrap_shortcode');

// Shortcode to display only the control panel
function semester_schema_control_panel_shortcode() {
    $currentYear = date("Y");
    return '
        <div id="sticky-controls" style="position: relative; display: flex; align-items: center; padding: 10px; gap: 10px; border-bottom: 1px solid #ddd; background: white;">
            <button class="btn btn-primary btn-sm" id="prevMonth">Föregående månad</button>
            <div>
                <label for="month-select" style="display: block;">Välj månad:</label>
                <select id="month-select" class="form-select form-select-sm">
                    <option value="0">Januari</option>
                    <option value="1">Februari</option>
                    <option value="2">Mars</option>
                    <option value="3">April</option>
                    <option value="4">Maj</option>
                    <option value="5">Juni</option>
                    <option value="6">Juli</option>
                    <option value="7">Augusti</option>
                    <option value="8">September</option>
                    <option value="9">Oktober</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                </select>
            </div>
            <div>
                <label for="week-select" style="display: block;">Välj vecka:</label>
                <select id="week-select" class="form-select form-select-sm">
                    ' . implode('', array_map(function($week) {
                        return "<option value=\"$week\">Vecka $week</option>";
                    }, range(1, 52))) . '
                </select>
            </div>
            <div>
                <label for="year-select" style="display: block;">Välj år:</label>
                <select id="year-select" class="form-select form-select-sm">
                    ' . implode('', array_map(function($year) use ($currentYear) {
                        $selected = ($year == $currentYear) ? 'selected' : '';
                        return "<option value=\"$year\" $selected>$year</option>";
                    }, range($currentYear - 3, $currentYear + 3))) . '
                </select>
            </div>
            <button class="btn btn-primary btn-sm" id="nextMonth">Nästa månad</button>
        </div>
    ';
}
add_shortcode('semester_schema_controls', 'semester_schema_control_panel_shortcode');
