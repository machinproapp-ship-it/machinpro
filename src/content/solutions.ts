/**
 * Páginas de solución (SEO) — una por problema concreto de una constructora pequeña.
 * Contenido por idioma; el inglés es el principal (Canadá / EE. UU.) y el español para España y LatAm.
 */

export type SolutionLang = "en" | "es";

export interface SolutionContent {
  title: string;
  description: string;
  kicker: string;
  h1: string;
  intro: string;
  problemsTitle: string;
  problems: string[];
  stepsTitle: string;
  steps: { title: string; body: string }[];
  plan: string;
  faq: { q: string; a: string }[];
}

export interface Solution {
  slug: string;
  content: Record<SolutionLang, SolutionContent>;
}

export const SOLUTION_UI: Record<
  SolutionLang,
  {
    cta: string;
    ctaSub: string;
    faqTitle: string;
    planTitle: string;
    otherTitle: string;
    seePricing: string;
    switchLang: string;
  }
> = {
  en: {
    cta: "Try it free for 14 days",
    ctaSub: "No credit card. Works on phone, tablet and computer.",
    faqTitle: "Questions",
    planTitle: "Which plan includes it",
    otherTitle: "More from MachinPro",
    seePricing: "See pricing",
    switchLang: "Leer en español",
  },
  es: {
    cta: "Pruébalo gratis 14 días",
    ctaSub: "Sin tarjeta. Funciona en móvil, tablet y ordenador.",
    faqTitle: "Preguntas",
    planTitle: "Qué plan lo incluye",
    otherTitle: "Más de MachinPro",
    seePricing: "Ver precios",
    switchLang: "Read in English",
  },
};

export const SOLUTIONS: Solution[] = [
  {
    slug: "construction-tool-tracking",
    content: {
      en: {
        title: "Construction Tool Tracking App with QR Codes",
        description:
          "Track drills, lasers and saws across job sites with a QR on every tool. See who has it, on which site and since when. Free 14-day trial.",
        kicker: "Tool tracking",
        h1: "Know who has every tool, on which site, and since when",
        intro:
          "Stick a QR code on every tool. Your shop or foreman scans it to hand it out or get it back, and your crew can report damage with a photo. No more “who has the laser level?”",
        problemsTitle: "Sound familiar?",
        problems: [
          "“Someone took it” — and nobody remembers who.",
          "The good drill is always “at the other site”.",
          "A broken saw goes back on the shelf and nobody finds out until the next job.",
          "You buy a tool you already own because you can't find it.",
        ],
        stepsTitle: "How it works",
        steps: [
          {
            title: "Label your tools",
            body: "Print a QR for each tool from MachinPro and stick it on. Each one has its own history.",
          },
          {
            title: "Scan to hand out or return",
            body: "The shop or the foreman scans the QR and picks the person and the site. Returning it is one tap.",
          },
          {
            title: "See what's out",
            body: "A “tools out” list shows who has each tool, where, and for how many days. Damage reports arrive with a photo.",
          },
        ],
        plan: "Included in the Logistics and All-in-one plans. You decide which roles can hand out tools and which workers can scan them.",
        faq: [
          {
            q: "Do my workers need to install an app?",
            a: "No. MachinPro runs in the phone's browser and can be added to the home screen. The camera reads the QR.",
          },
          {
            q: "Can workers take tools without the shop knowing?",
            a: "Only if you let them. By default, logistics and supervisors control tools. You can give specific workers permission to scan tools out themselves.",
          },
          {
            q: "What happens when a tool is damaged?",
            a: "Anyone with permission reports it with a note and a photo. The tool is marked out of service and logistics is notified right away.",
          },
        ],
      },
      es: {
        title: "App para controlar herramientas de obra con QR",
        description:
          "Controla taladros, láseres y sierras entre obras con un QR en cada herramienta. Quién la tiene, en qué obra y desde cuándo. 14 días gratis.",
        kicker: "Control de herramientas",
        h1: "Sabe quién tiene cada herramienta, en qué obra y desde cuándo",
        intro:
          "Pon un código QR en cada herramienta. El almacén o el encargado lo escanea para entregarla o recibirla, y la cuadrilla puede avisar de una avería con una foto. Se acabó el “¿quién tiene el láser?”.",
        problemsTitle: "¿Te suena?",
        problems: [
          "“Alguien se la llevó” y nadie sabe quién.",
          "El taladro bueno siempre está “en la otra obra”.",
          "Una sierra rota vuelve a la estantería y nadie se entera hasta la siguiente obra.",
          "Compras una herramienta que ya tienes porque no la encuentras.",
        ],
        stepsTitle: "Cómo funciona",
        steps: [
          {
            title: "Etiqueta tus herramientas",
            body: "Imprime un QR por herramienta desde MachinPro y pégalo. Cada una tiene su propio historial.",
          },
          {
            title: "Escanea para entregar o devolver",
            body: "El almacén o el encargado escanea el QR y elige la persona y la obra. Devolverla es un toque.",
          },
          {
            title: "Mira lo que está fuera",
            body: "La lista de “herramientas fuera” muestra quién tiene cada una, dónde y cuántos días lleva. Las averías llegan con foto.",
          },
        ],
        plan: "Incluido en los planes Logística y Todo incluido. Tú decides qué roles entregan herramientas y qué trabajadores pueden escanearlas.",
        faq: [
          {
            q: "¿Mis trabajadores tienen que instalar algo?",
            a: "No. MachinPro funciona en el navegador del móvil y se puede añadir a la pantalla de inicio. La cámara lee el QR.",
          },
          {
            q: "¿Pueden llevarse herramientas sin que se entere el almacén?",
            a: "Solo si tú lo permites. Por defecto las controlan logística y los supervisores. Puedes dar permiso a trabajadores concretos.",
          },
          {
            q: "¿Qué pasa si una herramienta se rompe?",
            a: "Quien tenga permiso la reporta con una nota y una foto. Queda fuera de servicio y logística recibe el aviso al momento.",
          },
        ],
      },
    },
  },
  {
    slug: "construction-timesheet-app",
    content: {
      en: {
        title: "Construction Time Clock & Timesheet App",
        description:
          "Your crew clocks in and out on their phone, on site. Hours, overtime and vacation add up on their own. Export timesheets for payroll. Free 14-day trial.",
        kicker: "Time clock & timesheets",
        h1: "Hours that add up on their own, ready for payroll",
        intro:
          "Your crew clocks in and out from their phone on site. MachinPro adds up regular hours, overtime and vacation with your company's rules, and exports a clean timesheet for your payroll provider or accountant.",
        problemsTitle: "Sound familiar?",
        problems: [
          "Friday afternoon chasing hours on paper, WhatsApp and memory.",
          "“I worked Saturday too” — with nothing to check it against.",
          "Overtime calculated by hand, differently every week.",
          "Typing the same hours twice into the payroll system.",
        ],
        stepsTitle: "How it works",
        steps: [
          {
            title: "Clock in on site",
            body: "Workers tap in and out on their phone. You can see who is on which site right now.",
          },
          {
            title: "Your rules, applied",
            body: "Set overtime by week and/or by day, and vacation pay %. MachinPro applies them to every timesheet.",
          },
          {
            title: "Export for payroll",
            body: "Export regular, overtime and vacation lines as CSV for your payroll provider or accountant.",
          },
        ],
        plan: "Included in every plan, from Essential. MachinPro prepares the hours; taxes and deductions stay with your payroll provider.",
        faq: [
          {
            q: "Does MachinPro run payroll?",
            a: "No. It prepares the hours (regular, overtime, vacation and gross) and exports them. Your payroll provider or accountant handles taxes and deductions.",
          },
          {
            q: "What if a worker forgets to clock out?",
            a: "The supervisor sees open shifts and can correct them. Every change is recorded and can't be erased.",
          },
          {
            q: "Does it work without signal?",
            a: "Yes. MachinPro keeps working offline and syncs when the phone gets signal again.",
          },
        ],
      },
      es: {
        title: "App de fichaje y hojas de horas para construcción",
        description:
          "La cuadrilla ficha entrada y salida desde el móvil en la obra. Horas, extras y vacaciones se suman solas. Exporta para la nómina. 14 días gratis.",
        kicker: "Fichaje y hojas de horas",
        h1: "Horas que se suman solas, listas para la nómina",
        intro:
          "La cuadrilla ficha entrada y salida desde el móvil en la obra. MachinPro suma horas normales, extras y vacaciones con las reglas de tu empresa, y exporta una hoja de horas limpia para tu gestoría o programa de nóminas.",
        problemsTitle: "¿Te suena?",
        problems: [
          "El viernes por la tarde persiguiendo horas en papel, WhatsApp y memoria.",
          "“El sábado también trabajé” y nada con qué comprobarlo.",
          "Horas extra calculadas a mano, cada semana de una forma.",
          "Pasar las mismas horas dos veces al programa de nóminas.",
        ],
        stepsTitle: "Cómo funciona",
        steps: [
          {
            title: "Fichaje en la obra",
            body: "Los trabajadores fichan desde el móvil. Ves quién está en cada obra ahora mismo.",
          },
          {
            title: "Tus reglas, aplicadas",
            body: "Configura las horas extra por semana y/o por día, y el % de vacaciones. MachinPro lo aplica en cada hoja.",
          },
          {
            title: "Exporta para la nómina",
            body: "Exporta las líneas de horas normales, extras y vacaciones en CSV para tu gestoría o programa de nóminas.",
          },
        ],
        plan: "Incluido en todos los planes, desde Esencial. MachinPro prepara las horas; impuestos y retenciones se quedan en tu gestoría.",
        faq: [
          {
            q: "¿MachinPro hace las nóminas?",
            a: "No. Prepara las horas (normales, extras, vacaciones y bruto) y las exporta. Impuestos y retenciones los hace tu gestoría o programa de nóminas.",
          },
          {
            q: "¿Y si un trabajador se olvida de fichar la salida?",
            a: "El supervisor ve los turnos abiertos y puede corregirlos. Cada cambio queda registrado y no se puede borrar.",
          },
          {
            q: "¿Funciona sin cobertura?",
            a: "Sí. MachinPro sigue funcionando sin conexión y sincroniza cuando el móvil vuelve a tener señal.",
          },
        ],
      },
    },
  },
  {
    slug: "construction-material-requests",
    content: {
      en: {
        title: "Site-to-Shop Material Requests for Contractors",
        description:
          "The foreman orders 2x4s, plywood or drywall from your shop inventory on his phone. The shop gets notified, ships it and the stock updates itself. Free 14-day trial.",
        kicker: "Material requests",
        h1: "“Bring me 3 sheets of plywood” without a single phone call",
        intro:
          "Your foreman picks what he needs from the shop inventory on his phone. The shop gets a notification, prepares it and sends it. The stock goes down on its own, and the site taps “Received” when it lands.",
        problemsTitle: "Sound familiar?",
        problems: [
          "Three phone calls to find out if the plywood is on the truck.",
          "Nobody knows how many 2x4s are left in the shop.",
          "Someone drives to the store for something you already had.",
          "Material leaves the shop and nobody knows which job it went to.",
        ],
        stepsTitle: "How it works",
        steps: [
          {
            title: "Order from the shop list",
            body: "The foreman sees what's in the shop and how much, and picks quantities. Anything not on the list can be typed in.",
          },
          {
            title: "The shop prepares and sends",
            body: "Logistics gets a notification, marks each line ready or out of stock, and dispatches it.",
          },
          {
            title: "Stock and history update",
            body: "Shop stock goes down automatically and every move is logged: who sent what, to which job, and when.",
          },
        ],
        plan: "Included in the Logistics and All-in-one plans. You decide who can order and who prepares.",
        faq: [
          {
            q: "Can the foreman order more than what's in stock?",
            a: "Yes. MachinPro warns him but never blocks him. Logistics marks what it can send and what's out.",
          },
          {
            q: "Does it also work for tools?",
            a: "Yes. Tools sent to a site are assigned to that job, so you know where they are.",
          },
          {
            q: "Do I have to load my whole inventory first?",
            a: "No. Start with the 20 things you move most — lumber, sheets, fasteners — and add the rest as you go. You can also import a spreadsheet.",
          },
        ],
      },
      es: {
        title: "Pedidos de material de la obra al almacén",
        description:
          "El encargado pide tablones, contrachapado o pladur del inventario del almacén desde el móvil. El almacén recibe el aviso, lo envía y el stock se actualiza solo. 14 días gratis.",
        kicker: "Pedidos de material",
        h1: "“Tráeme 3 tableros” sin una sola llamada",
        intro:
          "El encargado elige lo que necesita del inventario del almacén desde su móvil. El almacén recibe el aviso, lo prepara y lo envía. El stock baja solo y la obra marca “Recibido” cuando llega.",
        problemsTitle: "¿Te suena?",
        problems: [
          "Tres llamadas para saber si el material va en el camión.",
          "Nadie sabe cuántos tablones quedan en el almacén.",
          "Alguien va a la tienda a comprar algo que ya teníais.",
          "El material sale del almacén y nadie sabe a qué obra fue.",
        ],
        stepsTitle: "Cómo funciona",
        steps: [
          {
            title: "Pide desde la lista del almacén",
            body: "El encargado ve lo que hay y cuánto, y elige cantidades. Lo que no esté en la lista, lo escribe.",
          },
          {
            title: "El almacén prepara y envía",
            body: "Logística recibe el aviso, marca cada línea como lista o sin stock, y lo despacha.",
          },
          {
            title: "Stock e historial al día",
            body: "El stock del almacén baja solo y cada movimiento queda registrado: quién envió qué, a qué obra y cuándo.",
          },
        ],
        plan: "Incluido en los planes Logística y Todo incluido. Tú decides quién puede pedir y quién prepara.",
        faq: [
          {
            q: "¿Puede el encargado pedir más de lo que hay?",
            a: "Sí. MachinPro le avisa pero nunca le bloquea. Logística marca lo que puede mandar y lo que no hay.",
          },
          {
            q: "¿Sirve también para herramientas?",
            a: "Sí. Las herramientas enviadas a una obra quedan asignadas a esa obra, así sabes dónde están.",
          },
          {
            q: "¿Tengo que cargar todo el inventario primero?",
            a: "No. Empieza por las 20 cosas que más mueves y añade el resto poco a poco. También puedes importar una hoja de cálculo.",
          },
        ],
      },
    },
  },
  {
    slug: "construction-daily-report-app",
    content: {
      en: {
        title: "Construction Daily Report App",
        description:
          "Do the daily report on site from your phone: photos, crew, tasks, hazards and signatures. PDF ready for the client before you leave. Free 14-day trial.",
        kicker: "Daily reports",
        h1: "The daily report, done before you leave the site",
        intro:
          "Your supervisor fills it in on site from the phone: photos, who was there, tasks done, hazards and signatures. The PDF, with your company name, is ready to send to the client.",
        problemsTitle: "Sound familiar?",
        problems: [
          "Writing the daily report at 9 pm at the kitchen table.",
          "Site photos lost in five different phones.",
          "The client asks what happened on Tuesday and nobody has it written down.",
          "Safety briefings signed on paper that ends up in the truck.",
        ],
        stepsTitle: "How it works",
        steps: [
          {
            title: "Fill it in on site",
            body: "Crew on site, tasks done, weather, hazards and photos — straight from the phone.",
          },
          {
            title: "Sign it",
            body: "The crew confirms with “Got it” and the supervisor signs. Everything is dated and can't be edited later.",
          },
          {
            title: "Send the PDF",
            body: "Export a clean PDF with your company name and send it to the client or keep it for inspections.",
          },
        ],
        plan: "Included in the Operations and All-in-one plans.",
        faq: [
          {
            q: "Can I add my own forms and checklists?",
            a: "Yes. You create your own forms and inspections, and they can be filled in on site from any phone.",
          },
          {
            q: "Are the reports really tamper-proof?",
            a: "Signed reports and the audit log can't be edited or deleted — that's what protects you in an inspection.",
          },
          {
            q: "Can the client see the reports?",
            a: "You send them the PDF. Clients don't need an account.",
          },
        ],
      },
      es: {
        title: "App de parte diario de obra",
        description:
          "Haz el parte diario en la obra desde el móvil: fotos, personal, tareas, riesgos y firmas. PDF listo para el cliente antes de irte. 14 días gratis.",
        kicker: "Parte diario",
        h1: "El parte diario, hecho antes de salir de la obra",
        intro:
          "El supervisor lo rellena en la obra desde el móvil: fotos, quién estuvo, tareas hechas, riesgos y firmas. El PDF, con el nombre de tu empresa, queda listo para enviar al cliente.",
        problemsTitle: "¿Te suena?",
        problems: [
          "Escribir el parte a las 9 de la noche en la mesa de la cocina.",
          "Las fotos de obra perdidas en cinco móviles distintos.",
          "El cliente pregunta qué pasó el martes y nadie lo tiene apuntado.",
          "Charlas de seguridad firmadas en papel que acaba en la furgoneta.",
        ],
        stepsTitle: "Cómo funciona",
        steps: [
          {
            title: "Rellénalo en la obra",
            body: "Personal en obra, tareas, tiempo, riesgos y fotos, directamente desde el móvil.",
          },
          {
            title: "Fírmalo",
            body: "La cuadrilla confirma con “Enterado” y el supervisor firma. Todo queda fechado y no se puede editar después.",
          },
          {
            title: "Envía el PDF",
            body: "Exporta un PDF limpio con el nombre de tu empresa y envíalo al cliente o guárdalo para inspecciones.",
          },
        ],
        plan: "Incluido en los planes Operaciones y Todo incluido.",
        faq: [
          {
            q: "¿Puedo añadir mis propios formularios?",
            a: "Sí. Creas tus propios formularios e inspecciones, y se rellenan en la obra desde cualquier móvil.",
          },
          {
            q: "¿De verdad no se pueden modificar?",
            a: "Los partes firmados y el registro de auditoría no se pueden editar ni borrar. Eso es lo que te protege en una inspección.",
          },
          {
            q: "¿El cliente puede ver los partes?",
            a: "Le envías el PDF. El cliente no necesita cuenta.",
          },
        ],
      },
    },
  },
];

export function findSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
