/**
 * Legal texts shown in the app: health disclaimer, Terms of use, Privacy policy.
 *
 * Every text is versioned: when one changes in substance, bump `LEGAL_VERSION` and every user is asked to accept
 * again at the next start (see the consent gate in app/_layout.tsx and app/consent.tsx).
 *
 * BEFORE PUBLISHING: have the texts reviewed by a lawyer. They are a careful starting point, not legal advice.
 */

/** Bump when a text changes in substance: users accept again. ISO date of the version. */
export const LEGAL_VERSION = '2026-11-23';

/**
 * Data controller and contacts. FitLab is published by a private individual (free app, no VAT number): the
 * controller is the person, reachable at a dedicated email. If FitLab later becomes a business (VAT number or a
 * company), update these data and bump LEGAL_VERSION.
 */
export const LEGAL_ENTITY = {
  name: 'Fabio Fontana',
  email: 'fitlab.build.your.best@gmail.com',
} as const;

export type LegalDocId = 'disclaimer' | 'terms' | 'privacy';

export type LegalSection = { heading?: string; paragraphs: string[]; bullets?: string[] };
export type LegalDoc = { id: LegalDocId; title: string; subtitle: string; sections: LegalSection[] };

/** One line shown under plans, workouts and the AI coach. */
export const HEALTH_NOTICE_SHORT =
  'Contenuti generali di benessere: non sono prescrizioni e non sostituiscono il parere di un medico o di un professionista. In caso di gravidanza, patologie o farmaci, consulta un medico prima di iniziare.';

/** Shown in the AI coach. */
export const AI_NOTICE_SHORT =
  'Risposte generate dall’intelligenza artificiale: possono contenere errori e non sono consulenza medica o nutrizionale.';

const RED_FLAGS =
  'Interrompi subito l’attività e rivolgiti a un medico in caso di dolore al petto, vertigini, svenimento, difficoltà respiratorie, palpitazioni, dolore anomalo o qualsiasi malessere. In caso di emergenza chiama il 112.';

export const DISCLAIMER: LegalDoc = {
  id: 'disclaimer',
  title: 'Avvertenza sulla salute',
  subtitle: 'Da leggere prima di usare FitLab',
  sections: [
    {
      paragraphs: [
        'FitLab fornisce contenuti di carattere generale e informativo su alimentazione e attività fisica, pensati come spunti per uno stile di vita sano. Piani alimentari, ricette, stime caloriche, obiettivi e schede di allenamento sono calcolati automaticamente e non sono prescrizioni: non sono redatti né validati da medici, dietisti, biologi nutrizionisti, personal trainer o altri professionisti, salvo dove espressamente indicato.',
        'FitLab non fornisce diagnosi, terapie o consulenze mediche o nutrizionali e non sostituisce in alcun modo il parere di un professionista qualificato. Non è un dispositivo medico.',
      ],
    },
    {
      heading: 'Quando consultare prima un medico',
      paragraphs: ['Prima di iniziare qualsiasi programma alimentare o di allenamento consulta il tuo medico, in particolare se:'],
      bullets: [
        'sei in gravidanza, stai allattando o pianifichi una gravidanza;',
        'hai una patologia o una condizione medica (ad esempio cardiovascolare, metabolica come il diabete, renale, epatica, respiratoria o muscolo-scheletrica);',
        'assumi farmaci in modo continuativo o hai subito di recente interventi o infortuni;',
        'hai o hai avuto un rapporto difficile con il cibo o con il peso;',
        'hai allergie o intolleranze alimentari;',
        'hai più di 65 anni o non pratichi attività fisica da tempo.',
      ],
    },
    {
      heading: 'Limiti di sicurezza dell’app',
      paragraphs: [
        'FitLab è riservata ai maggiorenni. Per gravidanza, allattamento, condizioni mediche e disturbi del comportamento alimentare non genera piani alimentari automatici. I piani calcolati non scendono mai sotto una soglia calorica minima individuale e limitano deficit e surplus. Questi limiti riducono i rischi ma non li eliminano: valuta sempre come reagisce il tuo corpo.',
        'I valori nutrizionali e le stime di dispendio energetico sono indicativi e possono differire dai valori reali. In caso di allergie verifica sempre ingredienti ed etichette.',
      ],
    },
    { heading: 'Segnali di allarme', paragraphs: [RED_FLAGS] },
  ],
};

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Termini d’uso',
  subtitle: `Versione del ${LEGAL_VERSION}`,
  sections: [
    {
      heading: '1. Il servizio',
      paragraphs: [
        `FitLab è un’applicazione di benessere gratuita, sviluppata e pubblicata da ${LEGAL_ENTITY.name} come persona fisica (“FitLab”, “noi”). Offre contenuti generali su alimentazione e attività fisica, strumenti di monitoraggio e un assistente basato sull’intelligenza artificiale.`,
        'Il servizio non costituisce prestazione sanitaria, consulenza medica o nutrizionale, né attività riservata a professioni regolamentate. I contenuti sono generati automaticamente a partire dalle informazioni che fornisci e non derivano da una valutazione clinica.',
      ],
    },
    {
      heading: '2. Requisiti',
      paragraphs: [
        'Per usare FitLab devi avere almeno 18 anni. Dichiari di non trovarti in condizioni di salute che controindichino l’attività fisica o modifiche dell’alimentazione, oppure di aver ottenuto il parere favorevole del tuo medico. L’uso è sconsigliato, salvo diversa indicazione medica, in gravidanza o allattamento e in presenza di patologie o disturbi del comportamento alimentare.',
      ],
    },
    {
      heading: '3. Impegni dell’utente',
      paragraphs: ['Ti impegni a:'],
      bullets: [
        'fornire informazioni veritiere e aggiornate, in particolare su età, peso e condizioni di salute;',
        'leggere e rispettare l’Avvertenza sulla salute;',
        'eseguire gli esercizi con tecnica corretta, carichi adeguati e in un ambiente sicuro;',
        'interrompere l’attività e consultare un medico in caso di malessere;',
        'verificare ingredienti ed etichette in caso di allergie o intolleranze;',
        'custodire le credenziali dell’account e non usare il servizio per scopi illeciti.',
      ],
    },
    {
      heading: '4. Assistente AI',
      paragraphs: [
        'Le risposte dell’assistente sono generate automaticamente da modelli di intelligenza artificiale, possono essere imprecise o incomplete e non vanno usate per decisioni sulla salute senza il parere di un professionista.',
      ],
    },
    {
      heading: '5. Limitazione di responsabilità',
      paragraphs: [
        'Nei limiti massimi consentiti dalla legge applicabile, fatti salvi i casi di dolo o colpa grave e i diritti inderogabili riconosciuti ai consumatori, FitLab non risponde dei danni derivanti da: (a) uso dei contenuti in violazione dei presenti Termini o dell’Avvertenza sulla salute; (b) informazioni non veritiere o incomplete fornite dall’utente; (c) mancata consultazione di un medico nei casi indicati; (d) esecuzione scorretta degli esercizi; (e) interruzioni o malfunzionamenti del servizio non imputabili a FitLab.',
      ],
    },
    {
      heading: '6. Account e recesso',
      paragraphs: [
        'Puoi smettere di usare FitLab in qualsiasi momento ed eliminare l’account da Impostazioni → Elimina account: l’account e i dati associati vengono cancellati. Possiamo sospendere l’account in caso di violazione dei presenti Termini.',
      ],
    },
    {
      heading: '7. Modifiche, legge applicabile e contatti',
      paragraphs: [
        'Possiamo aggiornare questi Termini: le modifiche sostanziali ti verranno sottoposte di nuovo per l’accettazione. I Termini sono regolati dalla legge italiana; per i consumatori resta competente il foro del luogo di residenza o domicilio.',
        `Contatti: ${LEGAL_ENTITY.email}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Informativa privacy',
  subtitle: `Ai sensi degli artt. 13 e 9 del Regolamento UE 2016/679 (GDPR) · Versione del ${LEGAL_VERSION}`,
  sections: [
    {
      heading: '1. Titolare del trattamento',
      paragraphs: [
        `Il titolare del trattamento è ${LEGAL_ENTITY.name}, persona fisica che sviluppa e pubblica FitLab a titolo non commerciale. Per qualsiasi richiesta sulla privacy e per esercitare i tuoi diritti scrivi a ${LEGAL_ENTITY.email}.`,
      ],
    },
    {
      heading: '2. Dati trattati',
      paragraphs: ['Trattiamo solo i dati necessari a fornire il servizio:'],
      bullets: [
        'dati dell’account: nome, email, credenziali (la password è gestita in forma cifrata dal fornitore di autenticazione);',
        'dati del profilo e del questionario: età, sesso, altezza, obiettivi, livello di attività, preferenze alimentari e di allenamento;',
        'dati relativi alla salute (categoria particolare, art. 9 GDPR): peso, misure e foto corporee, alimenti e calorie registrati, allenamenti svolti, allergie e intolleranze, eventuali condizioni come gravidanza, allattamento, patologie o disturbi alimentari, dolori o infortuni, check-in mensili;',
        'dati di Apple Salute o Health Connect, solo se attivi l’integrazione: passi e calorie (attive e a riposo), in sola lettura;',
        'messaggi scambiati con il coach dell’app;',
        'dati tecnici necessari al funzionamento (ad esempio log di errore) e, se le attivi, le notifiche.',
      ],
    },
    {
      heading: '3. Finalità e basi giuridiche',
      paragraphs: [],
      bullets: [
        'Creazione e gestione dell’account, erogazione delle funzioni dell’app: esecuzione del contratto (art. 6.1.b GDPR).',
        'Trattamento dei dati relativi alla salute per calcolare piani, obiettivi e progressi e per le risposte dell’assistente AI: tuo consenso esplicito (art. 9.2.a GDPR), raccolto prima del questionario. Senza questo consenso il servizio non può essere fornito, perché si basa su questi dati.',
        'Sicurezza del servizio e prevenzione di abusi: legittimo interesse (art. 6.1.f GDPR).',
        'Adempimento di obblighi di legge: art. 6.1.c GDPR.',
      ],
    },
    {
      heading: '4. Intelligenza artificiale',
      paragraphs: [
        'Per alcune funzioni (impostazione della strategia dei piani, lettura di schede di allenamento caricate da te e, quando attivi, assistente conversazionale, suggerimenti e commento alle foto) i dati strettamente necessari alla richiesta sono inviati a fornitori di modelli di intelligenza artificiale che agiscono come responsabili del trattamento. Le decisioni su calorie e limiti di sicurezza restano calcolate dall’app con regole deterministiche. Non effettuiamo decisioni automatizzate che producono effetti giuridici su di te.',
      ],
    },
    {
      heading: '5. Destinatari e trasferimenti',
      paragraphs: [
        'I dati sono trattati da fornitori nominati responsabili del trattamento (art. 28 GDPR), tra cui: Supabase (database, autenticazione e archiviazione, server nell’Unione Europea), Anthropic (modelli di intelligenza artificiale), Voyage AI (ricerca semantica nella base di conoscenza), Vercel (versione web). Alcuni fornitori hanno sede negli Stati Uniti: in tal caso il trasferimento avviene sulla base del Data Privacy Framework UE-USA o delle Clausole contrattuali standard della Commissione europea.',
        'La ricerca di alimenti confezionati interroga la banca dati pubblica Open Food Facts senza inviare dati personali. I dati non sono venduti né usati per pubblicità.',
      ],
    },
    {
      heading: '6. Conservazione',
      paragraphs: [
        'I dati sono conservati finché l’account è attivo. Quando elimini l’account vengono cancellati dai sistemi attivi; eventuali copie di backup sono sovrascritte secondo i cicli del fornitore. Il registro dei consensi è conservato quanto l’account.',
      ],
    },
    {
      heading: '7. I tuoi diritti',
      paragraphs: [
        `Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento (artt. 15–22 GDPR) scrivendo a ${LEGAL_ENTITY.email}. Puoi revocare in qualsiasi momento il consenso al trattamento dei dati relativi alla salute: poiché il servizio si basa su questi dati, la revoca comporta l’eliminazione dell’account, disponibile in Impostazioni → Elimina account. La revoca non pregiudica la liceità del trattamento precedente.`,
        'Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).',
      ],
    },
    {
      heading: '8. Minori',
      paragraphs: ['FitLab non è destinata a persone di età inferiore a 18 anni e non ne raccoglie consapevolmente i dati.'],
    },
    {
      heading: '9. Sicurezza',
      paragraphs: [
        'I dati viaggiano su connessioni cifrate e ogni utente può accedere solo ai propri dati grazie a regole di accesso a livello di database. In caso di violazione dei dati che comporti rischi per i tuoi diritti, il Garante e, se necessario, tu stesso sarete informati nei termini di legge.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = { disclaimer: DISCLAIMER, terms: TERMS, privacy: PRIVACY };

/** The consents asked before the questionnaire. All three are required to use the service. */
export const CONSENT_ITEMS = [
  { id: 'age', label: 'Dichiaro di avere almeno 18 anni.' },
  {
    id: 'terms',
    label: 'Ho letto e accetto i Termini d’uso e l’Avvertenza sulla salute: i contenuti di FitLab sono spunti generali e non sostituiscono un medico o un professionista.',
  },
  {
    id: 'health',
    label: 'Acconsento al trattamento dei miei dati relativi alla salute (peso, alimentazione, allenamenti, condizioni indicate nel questionario) per ricevere piani e monitoraggio, come descritto nell’Informativa privacy.',
  },
] as const;

export type ConsentItemId = (typeof CONSENT_ITEMS)[number]['id'];
