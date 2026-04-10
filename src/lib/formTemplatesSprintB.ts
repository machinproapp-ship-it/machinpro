import type { FormTemplate } from "@/types/forms";

const INSP_OPTS = ["pass", "fail", "na"] as const;
const INSP_COLS = [
  { id: "status", label: "form_insp_col_status", kind: "select" as const },
  { id: "notes", label: "form_insp_col_notes", kind: "text" as const },
];

/** Sprint B — expanded base templates (i18n keys for labels). */
export const SPRINT_B_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "tpl-electric-tool-001",
    name: "form_tpl_electric_tool",
    description: "form_tpl_electric_tool_desc",
    region: ["GLOBAL"],
    category: "form_cat_tools",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 24,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "et_id",
        title: "form_sec_identification",
        fields: [
          { id: "et_tool_type", type: "text", label: "form_lbl_tool_type", required: true },
          { id: "et_brand", type: "text", label: "form_lbl_brand", required: true },
          { id: "et_model", type: "text", label: "form_lbl_model", required: true },
          { id: "et_asset_id", type: "text", label: "form_lbl_serial_or_id", required: true },
          { id: "et_date", type: "date", label: "form_lbl_date", required: true },
        ],
      },
      {
        id: "et_visual",
        title: "form_sec_visual_inspection",
        fields: [
          {
            id: "et_vis_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_cord", label: "form_et_row_power_cord" },
              { id: "r_housing", label: "form_et_row_housing" },
              { id: "r_switch", label: "form_et_row_switch" },
              { id: "r_guards", label: "form_et_row_guards" },
              { id: "r_disc", label: "form_et_row_disc_blade" },
              { id: "r_ground", label: "form_et_row_ground" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "et_func",
        title: "form_sec_functional_test",
        fields: [
          {
            id: "et_func_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_start", label: "form_et_row_start_ok" },
              { id: "r_vib", label: "form_et_row_vibration" },
              { id: "r_noise", label: "form_et_row_noise" },
              { id: "r_stop", label: "form_et_row_stop_ok" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "et_photo",
        title: "form_sec_photos",
        fields: [
          { id: "et_equip_photo", type: "photo", label: "form_lbl_equipment_photo", required: false },
        ],
      },
      {
        id: "et_sign",
        title: "form_sec_signoff",
        fields: [
          {
            id: "et_sig",
            type: "signature",
            label: "form_lbl_inspector_sig",
            required: true,
            formRole: "supervisor_signature",
          },
        ],
      },
    ],
  },
  {
    id: "tpl-scaffold-001",
    name: "form_tpl_scaffold",
    description: "form_tpl_scaffold_desc",
    region: ["GLOBAL"],
    category: "form_cat_scaffold",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 24,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "sc_id",
        title: "form_sec_identification",
        fields: [
          { id: "sc_location", type: "text", label: "form_lbl_location_site", required: true },
          { id: "sc_date", type: "date", label: "form_lbl_date", required: true },
          {
            id: "sc_inspector",
            type: "select",
            label: "form_lbl_inspector",
            required: true,
            options: [],
          },
        ],
      },
      {
        id: "sc_struct",
        title: "form_sec_structure",
        fields: [
          {
            id: "sc_struct_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_std", label: "form_sc_row_standards" },
              { id: "r_led", label: "form_sc_row_ledgers" },
              { id: "r_diag", label: "form_sc_row_braces" },
              { id: "r_tie", label: "form_sc_row_wall_ties" },
              { id: "r_lev", label: "form_sc_row_leveling" },
              { id: "r_base", label: "form_sc_row_base_sills" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "sc_access",
        title: "form_sec_access_platforms",
        fields: [
          {
            id: "sc_acc_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_lad", label: "form_sc_row_access_ladders" },
              { id: "r_plat", label: "form_sc_row_work_platforms" },
              { id: "r_guard", label: "form_sc_row_guardrails" },
              { id: "r_toe", label: "form_sc_row_toeboards" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "sc_load",
        title: "form_sec_load_signage",
        fields: [
          { id: "sc_max_load", type: "text", label: "form_lbl_max_load_visible", required: false },
          { id: "sc_signage", type: "textarea", label: "form_lbl_signage_ok", required: false },
        ],
      },
      {
        id: "sc_sign",
        title: "form_sec_signoff",
        fields: [
          {
            id: "sc_sig_insp",
            type: "signature",
            label: "form_lbl_inspector_sig",
            required: true,
          },
          {
            id: "sc_sig_sup",
            type: "signature",
            label: "form_lbl_supervisor_sig",
            required: true,
            formRole: "supervisor_signature",
          },
        ],
      },
    ],
  },
  {
    id: "tpl-ppe-check-001",
    name: "form_tpl_ppe_check",
    description: "form_tpl_ppe_check_desc",
    region: ["GLOBAL"],
    category: "form_cat_ppe",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 168,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "ppe_id",
        title: "form_sec_employee_info",
        fields: [
          { id: "ppe_name", type: "text", label: "form_lbl_employee_full_name", required: true },
          { id: "ppe_project", type: "text", label: "form_lbl_project", required: true },
          { id: "ppe_date", type: "date", label: "form_lbl_date", required: true },
        ],
      },
      {
        id: "ppe_table_sec",
        title: "form_sec_ppe_condition",
        fields: [
          {
            id: "ppe_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_helmet", label: "form_ppe_row_helmet" },
              { id: "r_vest", label: "form_ppe_row_vest" },
              { id: "r_boots", label: "form_ppe_row_boots" },
              { id: "r_glasses", label: "form_ppe_row_glasses" },
              { id: "r_gloves", label: "form_ppe_row_gloves" },
              { id: "r_harness", label: "form_ppe_row_harness" },
              { id: "r_hear", label: "form_ppe_row_hearing" },
              { id: "r_mask", label: "form_ppe_row_mask" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "ppe_ms",
        title: "form_sec_ppe_issued",
        fields: [
          {
            id: "ppe_issued",
            type: "multiselect",
            label: "form_ppe_ms_delivered",
            required: false,
            options: [
              "form_ppe_opt_helmet",
              "form_ppe_opt_vest",
              "form_ppe_opt_boots",
              "form_ppe_opt_glasses",
              "form_ppe_opt_gloves",
              "form_ppe_opt_harness",
              "form_ppe_opt_hearing",
              "form_ppe_opt_mask",
            ],
          },
        ],
      },
      {
        id: "ppe_sign",
        title: "form_sec_signoff",
        fields: [
          {
            id: "ppe_sig",
            type: "signature",
            label: "form_lbl_worker_sig",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "tpl-rental-vehicle-001",
    name: "form_tpl_rental_vehicle",
    description: "form_tpl_rental_vehicle_desc",
    region: ["GLOBAL"],
    category: "form_cat_rental",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 72,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "rv_id",
        title: "form_sec_rental_info",
        fields: [
          { id: "rv_supplier", type: "text", label: "form_lbl_supplier", required: true },
          { id: "rv_vtype", type: "text", label: "form_lbl_vehicle_type", required: true },
          { id: "rv_plate", type: "text", label: "form_lbl_vehicle_unit", required: true },
          { id: "rv_pickup", type: "date", label: "form_lbl_pickup_date", required: true },
          { id: "rv_km_in", type: "number", label: "form_lbl_km_in", required: true },
        ],
      },
      {
        id: "rv_ext",
        title: "form_sec_vehicle_exterior",
        fields: [
          {
            id: "rv_ext_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_f", label: "form_rv_row_body_front" },
              { id: "r_r", label: "form_rv_row_body_rear" },
              { id: "r_s", label: "form_rv_row_sides" },
              { id: "r_roof", label: "form_rv_row_roof" },
              { id: "r_glass", label: "form_rv_row_glass" },
              { id: "r_tires", label: "form_rv_row_tires" },
              { id: "r_lights", label: "form_rv_row_lights" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rv_int",
        title: "form_sec_vehicle_interior",
        fields: [
          {
            id: "rv_int_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_uph", label: "form_rv_row_upholstery" },
              { id: "r_dash", label: "form_rv_row_dashboard" },
              { id: "r_belts", label: "form_rv_row_seatbelts" },
              { id: "r_mir", label: "form_rv_row_mirrors" },
              { id: "r_ac", label: "form_rv_row_ac" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rv_levels",
        title: "form_sec_fluid_levels",
        fields: [
          {
            id: "rv_lvl_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_fuel", label: "form_rv_row_fuel" },
              { id: "r_oil", label: "form_rv_row_oil" },
              { id: "r_brake", label: "form_rv_row_brake_fluid" },
              { id: "r_cool", label: "form_rv_row_coolant" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rv_photos",
        title: "form_sec_photos",
        fields: [
          {
            id: "rv_photos",
            type: "photo",
            label: "form_lbl_vehicle_photos",
            required: false,
            multiple: true,
          },
        ],
      },
      {
        id: "rv_sign",
        title: "form_sec_signoff",
        fields: [
          { id: "rv_sig_driver", type: "signature", label: "form_lbl_driver_sig", required: true },
          {
            id: "rv_sig_prov",
            type: "signature",
            label: "form_lbl_provider_sig",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "tpl-rental-return-001",
    name: "form_tpl_rental_return",
    description: "form_tpl_rental_return_desc",
    region: ["GLOBAL"],
    category: "form_cat_rental",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 72,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "rr_id",
        title: "form_sec_rental_info",
        fields: [
          { id: "rr_supplier", type: "text", label: "form_lbl_supplier", required: true },
          { id: "rr_vtype", type: "text", label: "form_lbl_vehicle_type", required: true },
          { id: "rr_plate", type: "text", label: "form_lbl_vehicle_unit", required: true },
          { id: "rr_pickup", type: "date", label: "form_lbl_pickup_date", required: true },
          { id: "rr_km_in", type: "number", label: "form_lbl_km_in", required: true },
          { id: "rr_km_out", type: "number", label: "form_lbl_km_out", required: true },
        ],
      },
      {
        id: "rr_ext",
        title: "form_sec_vehicle_exterior",
        fields: [
          {
            id: "rr_ext_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_f", label: "form_rv_row_body_front" },
              { id: "r_r", label: "form_rv_row_body_rear" },
              { id: "r_s", label: "form_rv_row_sides" },
              { id: "r_roof", label: "form_rv_row_roof" },
              { id: "r_glass", label: "form_rv_row_glass" },
              { id: "r_tires", label: "form_rv_row_tires" },
              { id: "r_lights", label: "form_rv_row_lights" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rr_int",
        title: "form_sec_vehicle_interior",
        fields: [
          {
            id: "rr_int_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_uph", label: "form_rv_row_upholstery" },
              { id: "r_dash", label: "form_rv_row_dashboard" },
              { id: "r_belts", label: "form_rv_row_seatbelts" },
              { id: "r_mir", label: "form_rv_row_mirrors" },
              { id: "r_ac", label: "form_rv_row_ac" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rr_levels",
        title: "form_sec_fluid_levels",
        fields: [
          {
            id: "rr_lvl_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_fuel", label: "form_rv_row_fuel" },
              { id: "r_oil", label: "form_rv_row_oil" },
              { id: "r_brake", label: "form_rv_row_brake_fluid" },
              { id: "r_cool", label: "form_rv_row_coolant" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "rr_damage",
        title: "form_sec_new_damage",
        fields: [
          { id: "rr_new_damage", type: "textarea", label: "form_lbl_new_damage_notes", required: false },
        ],
      },
      {
        id: "rr_photos",
        title: "form_sec_photos",
        fields: [
          {
            id: "rr_photos",
            type: "photo",
            label: "form_lbl_vehicle_photos",
            required: false,
            multiple: true,
          },
        ],
      },
      {
        id: "rr_sign",
        title: "form_sec_signoff",
        fields: [
          { id: "rr_sig_driver", type: "signature", label: "form_lbl_driver_sig", required: true },
          {
            id: "rr_sig_prov",
            type: "signature",
            label: "form_lbl_provider_sig",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "tpl-forklift-001",
    name: "form_tpl_forklift",
    description: "form_tpl_forklift_desc",
    region: ["GLOBAL"],
    category: "form_cat_forklift",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 12,
    createdAt: "2026-04-10T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "fl_id",
        title: "form_sec_identification",
        fields: [
          { id: "fl_unit_id", type: "text", label: "form_lbl_forklift_id", required: true },
          { id: "fl_type", type: "text", label: "form_lbl_forklift_type", required: true },
          { id: "fl_date", type: "date", label: "form_lbl_date", required: true },
          {
            id: "fl_operator",
            type: "select",
            label: "form_lbl_operator",
            required: true,
            options: [],
          },
        ],
      },
      {
        id: "fl_pre",
        title: "form_sec_forklift_prestart",
        fields: [
          {
            id: "fl_pre_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_hyd", label: "form_fl_row_hydraulic_oil" },
              { id: "r_fuel", label: "form_fl_row_fuel_battery" },
              { id: "r_tires", label: "form_fl_row_tires_wheels" },
              { id: "r_fork", label: "form_fl_row_forks" },
              { id: "r_mast", label: "form_fl_row_mast_chains" },
              { id: "r_counter", label: "form_fl_row_counterweight" },
              { id: "r_seatbelt", label: "form_fl_row_seatbelt" },
              { id: "r_horn", label: "form_fl_row_horn" },
              { id: "r_lights", label: "form_fl_row_lights" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "fl_run",
        title: "form_sec_forklift_operation",
        fields: [
          {
            id: "fl_run_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_steer", label: "form_fl_row_steering" },
              { id: "r_brake", label: "form_fl_row_service_brake" },
              { id: "r_park", label: "form_fl_row_parking_brake" },
              { id: "r_lift", label: "form_fl_row_lift_lower" },
              { id: "r_tilt", label: "form_fl_row_mast_tilt" },
              { id: "r_horn_op", label: "form_fl_row_horn_operational" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "fl_area",
        title: "form_sec_forklift_area",
        fields: [
          {
            id: "fl_area_table",
            type: "inspection_table",
            label: "form_lbl_inspection_matrix",
            required: true,
            options: [...INSP_OPTS],
            rows: [
              { id: "r_floor", label: "form_fl_row_ground_stable" },
              { id: "r_vis", label: "form_fl_row_visibility" },
              { id: "r_sig", label: "form_fl_row_area_markings" },
              { id: "r_load", label: "form_fl_row_loads_palletized" },
            ],
            columns: INSP_COLS,
          },
        ],
      },
      {
        id: "fl_photo",
        title: "form_sec_photos",
        fields: [
          { id: "fl_photo", type: "photo", label: "form_lbl_equipment_photo", required: false },
        ],
      },
      {
        id: "fl_sign",
        title: "form_sec_signoff",
        fields: [
          {
            id: "fl_sig",
            type: "signature",
            label: "form_lbl_operator_sig",
            required: true,
          },
        ],
      },
    ],
  },
];
