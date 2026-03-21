/*
  Ejecutar este script UNA SOLA VEZ para crear los usuarios demo.
  Pegar en Supabase → SQL Editor:

  -- Usuarios de prueba (crear desde Auth → Users en el dashboard)
  -- Admin:      admin@machinpro.com      / Admin2026!
  -- Supervisor: supervisor@machinpro.com / Super2026!
  -- Worker:     trabajador@machinpro.com / Worker2026!
  -- Logistic:   logistica@machinpro.com  / Logis2026!

  -- Después de crear los usuarios en Auth → Users,
  -- ejecutar este SQL con los UUIDs reales:

  INSERT INTO user_profiles (id, employee_id, role) VALUES
    ('UUID-DEL-ADMIN',      null,  'admin'),
    ('UUID-DEL-SUPERVISOR', 'e1',  'supervisor'),
    ('UUID-DEL-WORKER',     'e4',  'worker'),
    ('UUID-DEL-LOGISTIC',   'e2',  'logistic');
*/

