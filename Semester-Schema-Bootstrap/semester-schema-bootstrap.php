<?php
/**
 * Plugin Name: Semester Schema Bootstrap
 * Description: A plugin to display a semester schedule using Bootstrap tables.
 * Version: 1.1
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
        'nonce' => wp_create_nonce('wp_rest')
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
}
add_action('rest_api_init', 'semester_schema_register_routes');

// Load schedule data from the database
function semester_schema_load_data() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'semester_schema';

    // Fetch all records from the `semester_schema` table
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
    $users = get_users(array('fields' => array('display_name')));
    return array_map(function($user) {
        return $user->display_name;
    }, $users);
}

// Save schedule data to the database
function semester_schema_save_data(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'semester_schema';

    $person = $request->get_param('person');
    $datum = $request->get_param('datum');
    $status = $request->get_param('status');

    // Validate incoming data
    if (empty($person) || empty($datum)) {
        return new WP_Error('invalid_data', 'Person and date are required.', array('status' => 400));
    }

    // Check if the record already exists
    $existing = $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM $table_name WHERE person = %s AND datum = %s", $person, $datum)
    );

    if ($existing) {
        // Update the existing record
        $wpdb->update(
            $table_name,
            array('status' => $status),
            array('person' => $person, 'datum' => $datum),
            array('%s'),
            array('%s', '%s')
        );
    } else {
        // Insert a new record
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

// Create the `semester_schema` table on plugin activation
function semester_schema_create_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'semester_schema';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        person VARCHAR(255) NOT NULL,
        datum DATE NOT NULL,
        status VARCHAR(255) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY person_datum_unique (person, datum)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'semester_schema_create_table');

// Shortcode to display the schedule
function semester_schema_bootstrap_shortcode($atts) {
    return '<div id="semester-schema-bootstrap-container" class="table-responsive"></div>';
}
add_shortcode('semester_schema_bootstrap', 'semester_schema_bootstrap_shortcode');

// Shortcode to display only the control panel
function semester_schema_control_panel_shortcode() {
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
            <button class="btn btn-primary btn-sm" id="nextMonth">Nästa månad</button>
        </div>
    ';
}
add_shortcode('semester_schema_controls', 'semester_schema_control_panel_shortcode');