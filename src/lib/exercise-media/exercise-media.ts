/**
 * Exercise GIF + instructions, sourced from the hasaneyldrm/exercises-dataset
 * GitHub repo (MIT-licensed data/instructions; media © Gym visual, used per
 * that repo's redistribution terms — https://gymvisual.com/). GIFs are
 * loaded on demand from GitHub's raw CDN rather than bundled, since the
 * full dataset is 100+ MB of media we only need ~30 exercises from.
 *
 * Keyed by this app's own exercise ids (see lib/planning/exercise-library.ts)
 * — not the dataset's own ids — so the training planner never needs to know
 * this mapping exists.
 */

const RAW_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
const ATTRIBUTION = '© Gym visual — gymvisual.com (via hasaneyldrm/exercises-dataset su GitHub)';

export type ExerciseMedia = {
  gifUrl: string;
  target: string;
  instructions: string;
  doTips: string[];
  dontTips: string[];
  attribution: string;
};

function entry(gif: string, target: string, instructions: string, doTips: string[], dontTips: string[]): ExerciseMedia {
  return { gifUrl: RAW_BASE + gif, target, instructions, doTips, dontTips, attribution: ATTRIBUTION };
}

const LATERAL_RAISE_DO = [
  'Mantieni una leggera piega ai gomiti per tutto il movimento.',
  'Solleva i manubri fino all’altezza delle spalle, non oltre.',
  'Controlla la fase di discesa.',
];
const LATERAL_RAISE_DONT = [
  'Non usare slancio del busto per sollevare il peso.',
  'Non salire oltre la linea delle spalle.',
  'Non usare carichi troppo pesanti a scapito della tecnica.',
];

export const EXERCISE_MEDIA: Record<string, ExerciseMedia> = {
  'back-squat': entry(
    'videos/0043-qXTaZnJ.gif',
    'Glutei, quadricipiti',
    "Stai con i piedi alla larghezza delle spalle, le dita leggermente rivolte verso l'esterno. Tieni il bilanciere sulla parte superiore della schiena, appoggiandolo sulle trappole o sui deltoidi posteriori. Coinvolgi il tuo core e mantieni il petto sollevato mentre inizi ad abbassare il corpo. Piega le ginocchia e i fianchi, spingendo i fianchi indietro e in basso come se fossi seduto su una sedia. Abbassati finché le cosce non sono parallele al suolo o leggermente più in basso. Tieni le ginocchia in linea con le dita dei piedi e il peso sui talloni. Spingi i talloni per rialzarti, estendendo i fianchi e le ginocchia.",
    [
      'Mantieni il petto alto e la schiena neutra per tutto il movimento.',
      'Scendi finché le cosce sono parallele al pavimento o più in basso.',
      'Spingi attraverso i talloni per risalire.',
    ],
    [
      'Non lasciare che le ginocchia cadano verso l’interno.',
      'Non inarcare eccessivamente la parte bassa della schiena.',
      'Non sollevare i talloni da terra.',
    ]
  ),
  'panca-piana': entry(
    'videos/0025-EIeI8Vf.gif',
    'Petto, tricipiti',
    'Sdraiati su una panca con i piedi appoggiati a terra e la schiena premuta contro la panca. Afferra il bilanciere con una presa prona leggermente più larga della larghezza delle spalle. Solleva il bilanciere dal rack e tienilo direttamente sopra il petto con le braccia completamente distese. Abbassa lentamente il bilanciere verso il petto, tenendo i gomiti piegati. Fai una pausa quando il bilanciere tocca il petto, poi spingilo nella posizione iniziale estendendo le braccia.',
    [
      'Ritrai le scapole e mantieni i piedi ben piantati a terra.',
      'Abbassa il bilanciere con controllo fino a sfiorare il petto.',
      'Spingi in linea retta verso l’alto.',
    ],
    [
      'Non far rimbalzare il bilanciere sul petto.',
      'Non sollevare i fianchi dalla panca.',
      'Non allargare troppo i gomiti verso l’esterno.',
    ]
  ),
  'rematore-bilanciere': entry(
    'videos/0027-eZyBC3j.gif',
    'Dorso, bicipiti',
    'Stai in piedi con i piedi alla larghezza delle spalle e le ginocchia leggermente piegate. Piegati in avanti sui fianchi mantenendo la schiena dritta e il petto in alto. Afferra il bilanciere con una presa prona, con le mani leggermente più larghe della larghezza delle spalle. Tira il bilanciere verso la parte inferiore del torace ritraendo le scapole e contraendo i muscoli della schiena. Fermati un momento in alto, poi abbassa lentamente il bilanciere nella posizione iniziale.',
    [
      'Mantieni la schiena dritta e il core attivo per tutta la serie.',
      'Tira il bilanciere verso l’addome stringendo le scapole.',
      'Controlla la fase di discesa.',
    ],
    [
      'Non usare lo slancio della schiena per tirare il peso.',
      'Non arrotondare la parte bassa della schiena.',
      'Non far penzolare le braccia senza controllo in basso.',
    ]
  ),
  plank: entry(
    'videos/0464-CosupLu.gif',
    'Addome, core',
    'Posizionati a terra appoggiando avambracci e punte dei piedi, con i gomiti sotto le spalle. Mantieni il corpo in linea retta dalla testa ai talloni, senza far cadere né sollevare i fianchi. Contrai addome e glutei e mantieni la posizione respirando in modo regolare per il tempo richiesto.',
    [
      'Mantieni il corpo in linea retta dalla testa ai talloni.',
      'Contrai addome e glutei per stabilizzare il bacino.',
      'Respira in modo regolare durante la tenuta.',
    ],
    ['Non far cadere i fianchi verso il basso.', 'Non alzare troppo il bacino verso l’alto.', 'Non trattenere il respiro.']
  ),
  'trazioni-sbarra': entry(
    'videos/0652-lBDjFxJ.gif',
    'Dorsali, bicipiti',
    'Appenditi a una barra per trazioni con i palmi delle mani rivolti lontano da te e le braccia completamente distese. Coinvolgi il tuo core e stringi insieme le scapole. Tira il corpo verso la sbarra piegando i gomiti e portando il petto verso la sbarra. Fai una pausa nella parte superiore del movimento, quindi abbassa lentamente il corpo fino alla posizione iniziale.',
    [
      'Parti da un dead hang con le braccia distese.',
      'Porta il petto verso la sbarra stringendo le scapole.',
      'Scendi in modo controllato fino alla distensione completa.',
    ],
    [
      'Non usare slancio delle gambe per aiutarti, se l’obiettivo è la forza.',
      'Non fermarti a metà movimento.',
      'Non tendere il collo in avanti per raggiungere la barra.',
    ]
  ),
  'military-press': entry(
    'videos/1456-wdRZISl.gif',
    'Spalle, tricipiti',
    'Stai con i piedi a larghezza delle spalle e tieni il bilanciere con una presa prona, mani leggermente più vicine della larghezza delle spalle. Solleva il bilanciere all’altezza delle spalle, tenendo i gomiti vicini al corpo. Premi il bilanciere sopra la testa, estendendo completamente le braccia, poi abbassalo fino all’altezza delle spalle.',
    [
      'Tieni i gomiti leggermente avanti al bilanciere in partenza.',
      'Spingi in verticale mantenendo il core attivo.',
      'Estendi completamente le braccia in alto.',
    ],
    [
      'Non inarcare eccessivamente la schiena per spingere il peso.',
      'Non far oscillare il bilanciere in avanti.',
      'Non usare carichi che ti obbligano a spingere con le gambe.',
    ]
  ),
  'curl-bicipiti': entry(
    'videos/0031-25GPyDY.gif',
    'Bicipiti',
    'Stai dritto con i piedi alla larghezza delle spalle e tieni un bilanciere con una presa supina, palmi rivolti in avanti. Tieni i gomiti vicini al busto ed espira mentre pieghi i pesi contraendo i bicipiti, finché non sono all’altezza delle spalle. Mantieni la contrazione per un istante, poi inspira e abbassa lentamente il bilanciere.',
    [
      'Tieni i gomiti fermi vicino al busto.',
      'Contrai i bicipiti in alto per un istante.',
      'Scendi lentamente controllando il peso.',
    ],
    [
      'Non oscillare il busto per aiutarti a sollevare il peso.',
      'Non muovere i gomiti in avanti durante la risalita.',
      'Non lasciare cadere il peso in fase di discesa.',
    ]
  ),
  'romanian-deadlift': entry(
    'videos/0085-wQ2c4XD.gif',
    'Glutei, femorali',
    "Stai con i piedi alla larghezza delle spalle e le dita dei piedi rivolte in avanti. Tieni il bilanciere con una presa prona, mani leggermente più larghe delle spalle. Piegati sui fianchi mantenendo la schiena dritta e le ginocchia leggermente piegate, abbassando il bilanciere vicino al corpo finché non senti l'allungamento dei femorali. Spingi i fianchi in avanti e torna dritto, contraendo i glutei in cima.",
    [
      'Mantieni il bilanciere vicino alle gambe per tutto il movimento.',
      'Spingi i fianchi indietro mantenendo la schiena dritta.',
      'Fermati quando senti lo stiramento dei femorali.',
    ],
    [
      'Non arrotondare la schiena durante la discesa.',
      'Non piegare troppo le ginocchia: non è uno squat.',
      'Non scendere oltre il tuo range di mobilità dell’anca.',
    ]
  ),
  'leg-press': entry(
    'videos/0739-10Z2DXU.gif',
    'Quadricipiti, glutei',
    'Siediti sulla macchina con la schiena contro lo schienale e i piedi alla larghezza delle spalle sulla pedana. Allontana la pedana dal corpo estendendo le gambe, mantenendo i talloni appoggiati, finché le gambe non sono quasi completamente estese senza bloccare le ginocchia. Fai una pausa in cima, poi abbassa lentamente la pedana verso il corpo piegando le ginocchia.',
    [
      'Mantieni i talloni ben appoggiati sulla pedana.',
      'Controlla la discesa senza far rimbalzare il peso sul fondo.',
      'Evita di bloccare completamente le ginocchia in alto.',
    ],
    [
      'Non estendere completamente le ginocchia con uno scatto secco.',
      'Non sollevare il bacino dal sedile durante la spinta.',
      'Non usare un range di movimento eccessivo che stacca troppo i fianchi.',
    ]
  ),
  affondi: entry(
    'videos/0054-t8iSghb.gif',
    'Glutei, quadricipiti',
    'Stai in piedi con i piedi alla larghezza delle spalle e un bilanciere appoggiato sulla parte superiore della schiena. Fai un passo avanti con una gamba, mantenendo il busto eretto. Abbassa il corpo piegando il ginocchio anteriore finché la coscia non è parallela al suolo. Spingi attraverso il tallone anteriore per tornare alla posizione di partenza, alternando le gambe.',
    [
      'Fai un passo abbastanza ampio da formare un angolo di 90° con entrambe le ginocchia.',
      'Mantieni il busto eretto durante tutto il movimento.',
      'Spingi con il tallone anteriore per risalire.',
    ],
    [
      'Non far avanzare il ginocchio oltre la punta del piede in modo eccessivo.',
      'Non far toccare bruscamente il ginocchio posteriore a terra.',
      'Non inclinare troppo il busto in avanti perdendo l’equilibrio.',
    ]
  ),
  'dip-parallele': entry(
    'videos/0251-9WTm7dq.gif',
    'Petto, tricipiti',
    'Posizionati sulle barre parallele con le braccia completamente estese e il corpo dritto. Abbassa il corpo piegando i gomiti finché le spalle non sono sotto i gomiti. Spingi di nuovo verso la posizione iniziale raddrizzando le braccia.',
    [
      'Scendi finché le spalle non sono leggermente sotto i gomiti.',
      'Inclina leggermente il busto in avanti per coinvolgere il petto.',
      'Spingi in modo controllato fino alla distensione completa.',
    ],
    [
      'Non scendere troppo se avverti tensione eccessiva alle spalle.',
      'Non lasciare che i gomiti si aprano troppo verso l’esterno.',
      'Non usare slanci con le gambe per risalire.',
    ]
  ),
  'alzate-laterali': entry(
    'videos/0334-DsgkuIt.gif',
    'Spalle',
    'Stai in piedi con i piedi alla larghezza delle spalle e tieni un manubrio in ogni mano, palmi rivolti verso il corpo. Tieni la schiena dritta e attiva il core. Alza le braccia ai lati finché non sono parallele al pavimento, mantenendo una leggera piega dei gomiti. Fermati un attimo in cima, poi abbassa lentamente le braccia.',
    LATERAL_RAISE_DO,
    LATERAL_RAISE_DONT
  ),
  'stacco-da-terra': entry(
    'videos/0032-ila4NZS.gif',
    'Glutei, femorali, dorso',
    'Stai con i piedi alla larghezza delle spalle e il bilanciere a terra davanti a te. Piega le ginocchia e fai perno sui fianchi per afferrare il bilanciere con una presa prona. Tieni la schiena dritta e il petto sollevato mentre spingi i talloni per sollevare il bilanciere da terra, estendendo fianchi e ginocchia. Contrai i glutei in piedi, poi abbassa il bilanciere a terra ripetendo lo schema inverso.',
    [
      'Mantieni il bilanciere vicino alle tibie per tutta la salita.',
      'Spingi il pavimento con i piedi mantenendo la schiena neutra.',
      'Contrai i glutei in cima al movimento.',
    ],
    [
      'Non arrotondare la schiena in nessuna fase del movimento.',
      'Non tirare il peso solo con le braccia.',
      'Non iniziare con i fianchi troppo alti o troppo bassi.',
    ]
  ),
  'trazioni-zavorrate': entry(
    'videos/0841-HMzLjXx.gif',
    'Dorsali, bicipiti',
    'Afferra la barra per trazioni con una presa prona, leggermente più larga della larghezza delle spalle, con un peso aggiuntivo assicurato alla cintura o tra i piedi. Appenditi con le braccia completamente distese. Tira il corpo verso la barra finché il mento non la supera, poi abbassati lentamente fino alla distensione completa.',
    [
      'Aggiungi carico solo quando padroneggi le trazioni a corpo libero.',
      'Parti da un dead hang completo a ogni ripetizione.',
      'Controlla sempre la fase di discesa.',
    ],
    [
      'Non aggiungere peso se la tecnica peggiora.',
      'Non accorciare il range di movimento per gestire il carico extra.',
      'Non oscillare il corpo per generare slancio.',
    ]
  ),
  'squat-manubri': entry(
    'videos/1760-yn8yg1r.gif',
    'Quadricipiti, glutei',
    'Stai con i piedi a larghezza delle spalle, tenendo un manubrio verticalmente contro il petto con entrambe le mani. Mantenendo il petto sollevato e il core attivo, abbassa il corpo in posizione squat spingendo indietro i fianchi e piegando le ginocchia, finché le cosce non sono parallele al suolo. Spingi attraverso i talloni per tornare alla posizione di partenza.',
    [
      'Tieni il manubrio vicino al petto per tutto il movimento.',
      'Scendi mantenendo il busto eretto e le ginocchia in linea con i piedi.',
      'Spingi attraverso i talloni per risalire.',
    ],
    [
      'Non inclinare troppo il busto in avanti.',
      'Non far collassare le ginocchia verso l’interno.',
      'Non sollevare i talloni da terra durante la discesa.',
    ]
  ),
  'push-up': entry(
    'videos/0662-I4hDWkc.gif',
    'Petto, tricipiti, core',
    'Inizia in posizione di plancia alta con le mani leggermente più larghe delle spalle e i piedi uniti. Coinvolgi il core e abbassa il corpo verso terra piegando i gomiti, mantenendo il corpo in linea retta. Fai una pausa quando il petto è appena sopra il suolo, poi torna alla posizione di partenza raddrizzando le braccia.',
    [
      'Mantieni il corpo in linea retta dalla testa ai piedi.',
      'Scendi finché il petto sfiora quasi il pavimento.',
      'Attiva il core per evitare che i fianchi cedano.',
    ],
    ['Non far cadere i fianchi verso il basso.', 'Non alzare eccessivamente il bacino.', 'Non limitare il range di movimento.']
  ),
  'rematore-manubrio': entry(
    'videos/0293-BJ0Hz5L.gif',
    'Dorso, bicipiti',
    'Stai con i piedi a larghezza delle spalle, le ginocchia leggermente piegate, e tieni un manubrio in ciascuna mano. Piegati in avanti sui fianchi mantenendo la schiena dritta. Lascia pendere le braccia verso il pavimento, poi tira i manubri verso il petto stringendo le scapole insieme. Abbassa lentamente i manubri fino alla posizione iniziale.',
    [
      'Mantieni la schiena dritta e quasi parallela al pavimento.',
      'Tira il manubrio verso il fianco stringendo la scapola.',
      'Controlla il peso in fase di discesa.',
    ],
    [
      'Non ruotare il busto per aiutarti a tirare il peso.',
      'Non usare slancio delle gambe.',
      'Non arrotondare la parte bassa della schiena.',
    ]
  ),
  'rematore-elastico': entry(
    'videos/0988-km0sQC0.gif',
    'Dorso',
    "Attacca la fascia a un punto di ancoraggio stabile all'altezza della vita. Stai di fronte al punto di ancoraggio e tieni la fascia con una mano, facendo un passo indietro per creare tensione. Piega leggermente le ginocchia e fai perno in avanti sui fianchi. Tira la fascia verso la vita stringendo insieme le scapole, poi rilascia lentamente.",
    [
      'Mantieni tensione costante sull’elastico per tutta la serie.',
      'Stringi le scapole nella fase di tirata.',
      'Mantieni la schiena stabile durante il movimento.',
    ],
    [
      'Non lasciare che l’elastico si allenti a fine ripetizione.',
      'Non usare slancio del busto per completare il movimento.',
      'Non arrotondare le spalle in avanti nella fase finale.',
    ]
  ),
  'shoulder-press-manubri': entry(
    'videos/0405-znQUdHY.gif',
    'Spalle, tricipiti',
    'Siediti con un manubrio in ogni mano, appoggiato sulle cosce. Alza i manubri all’altezza delle spalle, palmi rivolti in avanti. Premi i manubri verso l’alto finché le braccia non sono completamente estese sopra la testa, poi abbassa lentamente fino all’altezza delle spalle.',
    [
      'Parti con i manubri all’altezza delle spalle.',
      'Spingi verso l’alto mantenendo il core stabile.',
      'Controlla la discesa fino alla posizione di partenza.',
    ],
    [
      'Non inarcare eccessivamente la schiena per spingere il peso.',
      'Non far urtare i manubri in cima con forza eccessiva.',
      'Non usare un carico che ti costringe a spingere con le gambe.',
    ]
  ),
  'curl-manubri': entry(
    'videos/0294-NbVPDMW.gif',
    'Bicipiti',
    'Stai dritto con un manubrio in ogni mano, palmi rivolti in avanti e braccia completamente estese. Mantenendo ferme le braccia superiori, espira e piega i pesi contraendo i bicipiti finché non sono all’altezza delle spalle. Mantieni la contrazione un istante, poi inspira e abbassa lentamente i manubri.',
    [
      'Tieni i gomiti fermi lungo i fianchi.',
      'Contrai i bicipiti in cima al movimento.',
      'Esegui con tecnica controllata, senza slanci.',
    ],
    [
      'Non oscillare il busto per sollevare il peso.',
      'Non muovere le spalle in avanti durante la risalita.',
      'Non lasciare cadere il peso in discesa.',
    ]
  ),
  'affondi-manubri': entry(
    'videos/0336-RRWFUcw.gif',
    'Glutei, quadricipiti',
    'Stai con i piedi a larghezza delle spalle, tenendo un manubrio in ciascuna mano. Fai un passo avanti con una gamba, abbassando il corpo in posizione di affondo mantenendo la schiena dritta e il petto sollevato. Spingi attraverso il tallone anteriore per tornare alla posizione di partenza, alternando le gambe.',
    [
      'Fai un passo ampio a sufficienza per un angolo di 90° al ginocchio anteriore.',
      'Mantieni il busto eretto durante il movimento.',
      'Spingi con il tallone anteriore per tornare in piedi.',
    ],
    [
      'Non far sporgere il ginocchio troppo oltre la punta del piede.',
      'Non perdere l’equilibrio con un passo troppo corto.',
      'Non far toccare bruscamente il ginocchio posteriore a terra.',
    ]
  ),
  'hip-thrust': entry(
    'videos/3013-u0cNiij.gif',
    'Glutei',
    "Sdraiati sulla schiena con le ginocchia piegate e i piedi appoggiati a terra. Metti le braccia lungo i fianchi. Coinvolgi glutei e core, poi solleva i fianchi da terra finché il corpo non forma una linea retta dalle ginocchia alle spalle. Fermati un attimo in alto contraendo i glutei, poi abbassa lentamente.",
    [
      'Spingi i fianchi verso l’alto contraendo bene i glutei in cima.',
      'Mantieni il mento leggermente rivolto verso il basso.',
      'Appoggia bene i piedi a terra per tutta la spinta.',
    ],
    [
      'Non iperestendere la parte bassa della schiena in cima al movimento.',
      'Non spingere con le gambe invece che con i glutei.',
      'Non scendere troppo velocemente senza controllo.',
    ]
  ),
  'polpacci-piedi': entry(
    'videos/1373-bJYHBIN.gif',
    'Polpacci',
    "Stai in piedi con i piedi alla larghezza delle spalle. Appoggia le mani su un muro o una superficie stabile per l'equilibrio. Alza lentamente i talloni da terra sollevando il peso sulle punte dei piedi. Fermati un attimo in cima, poi abbassa lentamente i talloni.",
    [
      'Sali il più possibile sulle punte dei piedi.',
      'Fai una pausa in cima contraendo i polpacci.',
      'Scendi con controllo fino a sentire un leggero allungamento.',
    ],
    [
      'Non usare rimbalzi per generare slancio.',
      'Non ridurre il range di movimento per fare più ripetizioni velocemente.',
      'Non bloccare le ginocchia in modo rigido.',
    ]
  ),
  'dip-sedia': entry(
    'videos/0129-RrLske5.gif',
    'Tricipiti, petto',
    'Siediti sul bordo di una panca o sedia con le mani che stringono il bordo accanto ai fianchi. Fai scivolare il sedere fuori dalla panca e distendi le gambe davanti a te. Piega i gomiti e abbassa il corpo verso terra tenendo la schiena vicino alla panca, poi risali fino alla posizione iniziale.',
    [
      'Mantieni i talloni a terra e le gambe distese davanti a te.',
      'Scendi piegando i gomiti mantenendo la schiena vicina alla panca.',
      'Spingi per risalire fino alla distensione completa delle braccia.',
    ],
    [
      'Non scendere troppo se avverti fastidio alle spalle.',
      'Non allontanare troppo i piedi dal corpo.',
      'Non far ruotare i gomiti verso l’esterno.',
    ]
  ),
  'alzate-laterali-manubri': entry(
    'videos/0334-DsgkuIt.gif',
    'Spalle',
    'Stai in piedi con i piedi alla larghezza delle spalle e tieni un manubrio in ogni mano, palmi rivolti verso il corpo. Tieni la schiena dritta e attiva il core. Alza le braccia ai lati finché non sono parallele al pavimento, mantenendo una leggera piega dei gomiti. Fermati un attimo in cima, poi abbassa lentamente le braccia.',
    LATERAL_RAISE_DO,
    LATERAL_RAISE_DONT
  ),
  'trazioni-lat-elastico': entry(
    'videos/0974-DptumMx.gif',
    'Dorsali, bicipiti',
    'Attacca la fascia a un punto di ancoraggio alto. Mettiti di fronte al punto di ancoraggio e afferra la fascia con una presa supina, mani alla larghezza delle spalle. Fai un passo indietro per creare tensione. Tira la fascia verso il petto stringendo le scapole insieme, poi rilascia lentamente.',
    [
      'Tira l’elastico verso il petto stringendo le scapole.',
      'Mantieni il busto stabile e leggermente inclinato indietro.',
      'Controlla il ritorno dell’elastico verso l’alto.',
    ],
    [
      'Non usare slancio del busto per tirare.',
      'Non alzare le spalle verso le orecchie durante la tirata.',
      'Non far scattare l’elastico senza controllo nel ritorno.',
    ]
  ),
  'face-pull-elastico': entry(
    'videos/1022-tc5dYrf.gif',
    'Deltoidi posteriori, trapezi',
    "Stai con i piedi alla larghezza delle spalle e posiziona la fascia sotto i piedi o a un ancoraggio all'altezza del viso. Tieni le maniglie con i palmi rivolti uno verso l'altro. Tira la fascia verso il viso separando le mani a fine corsa, stringendo le scapole. Rilascia lentamente la tensione.",
    [
      'Tira l’elastico verso il viso separando le mani a fine movimento.',
      'Mantieni i gomiti alti all’altezza delle spalle.',
      'Contrai bene i muscoli del dorso alto in cima al movimento.',
    ],
    [
      'Non usare tensioni eccessive a scapito della tecnica.',
      'Non lasciare cadere i gomiti in basso durante la tirata.',
      'Non tirare solo con le braccia ignorando le scapole.',
    ]
  ),
  'stacco-rumeno-manubri': entry(
    'videos/1459-rR0LJzx.gif',
    'Glutei, femorali',
    'Stai con i piedi a larghezza delle spalle, tenendo un manubrio in ogni mano. Mantenendo la schiena dritta e il core attivo, piegati sui fianchi abbassando i manubri verso terra vicino alle gambe, lasciando le ginocchia leggermente piegate. Scendi finché non senti lo stiramento dei femorali, poi spingi attraverso i talloni e contrai i glutei per risalire.',
    [
      'Mantieni i manubri vicini alle gambe per tutto il movimento.',
      'Spingi i fianchi indietro con la schiena neutra.',
      'Fermati quando senti lo stiramento dei femorali.',
    ],
    ['Non arrotondare la schiena durante la discesa.', 'Non piegare troppo le ginocchia.', 'Non scendere oltre il proprio range di mobilità.']
  ),
  'abductor-machine': entry(
    'videos/0597-CHpahtl.gif',
    'Abduttori, glutei',
    "Regola l'altezza del sedile in modo che le ginocchia formino un angolo di 90°. Siediti con la schiena appoggiata allo schienale e i piedi sulle pedane, mani sulle maniglie laterali per stabilità. Coinvolgi gli abduttori e allarga lentamente le gambe verso l'esterno. Fermati un attimo a fine corsa, poi riporta lentamente le gambe alla posizione di partenza.",
    [
      'Muovi le gambe con controllo, senza usare slancio.',
      'Fai una breve pausa a fine corsa contraendo gli abduttori.',
      'Mantieni la schiena appoggiata allo schienale per tutto il movimento.',
    ],
    [
      'Non usare un carico che ti obbliga a sollevare il bacino dal sedile.',
      'Non far tornare le gambe di scatto verso il centro.',
      'Non inarcare la schiena per compensare il carico.',
    ]
  ),
  'chest-press-machine': entry(
    'videos/0577-T0yTjgW.gif',
    'Petto, tricipiti',
    "Regola l'altezza del sedile e posizionati con la schiena appoggiata al cuscino. Afferra le maniglie con presa prona e gomiti a circa 90°. Spingi le maniglie in avanti finché le braccia non sono completamente distese, poi torna lentamente alla posizione di partenza.",
    [
      "Regola il sedile in modo che le maniglie siano all'altezza del petto.",
      'Spingi in linea retta in avanti senza bloccare di scatto i gomiti.',
      'Controlla il ritorno senza far sbattere i pesi.',
    ],
    [
      'Non inarcare la schiena per aiutarti nella spinta.',
      'Non far avanzare troppo le spalle in fase di ritorno.',
      'Non usare un carico che accorcia il range di movimento.',
    ]
  ),
  'lat-machine': entry(
    'videos/0579-7F1DVzn.gif',
    'Dorsali, bicipiti',
    'Regola l’altezza del sedile e siediti con le ginocchia sotto le imbottiture e i piedi a terra. Afferra le maniglie con presa prona, leggermente più larga delle spalle. Siediti eretto con il petto sollevato, coinvolgi i dorsali e tira le maniglie verso il petto stringendo le scapole. Rilascia lentamente verso la posizione iniziale.',
    [
      'Tira verso il petto stringendo bene le scapole.',
      'Mantieni il busto eretto senza inclinarti troppo indietro.',
      'Controlla la fase di risalita del peso.',
    ],
    [
      'Non usare slancio del busto per tirare il peso.',
      'Non far risalire il peso di scatto senza controllo.',
      'Non tirare la barra dietro la nuca.',
    ]
  ),
  'leg-curl-machine': entry(
    'videos/0599-Zg3XY7P.gif',
    'Femorali',
    'Regola la macchina e siediti con la schiena contro lo schienale, posizionando la parte inferiore delle gambe sotto la leva imbottita appena sopra le caviglie. Afferra le maniglie laterali per sostenerti. Mantenendo ferma la parte superiore delle gambe, piega le gambe il più possibile contraendo i femorali, poi abbassa lentamente la leva.',
    [
      'Mantieni ferma la parte superiore delle gambe per tutto il movimento.',
      'Contrai bene i femorali a fine corsa.',
      'Abbassa il peso con controllo, senza farlo cadere.',
    ],
    [
      'Non sollevare i fianchi dal sedile per aiutarti.',
      'Non usare scatti per completare la ripetizione.',
      'Non limitare il range di movimento per gestire più carico.',
    ]
  ),
  'polpacci-macchina': entry(
    'videos/0594-bOOdeyc.gif',
    'Polpacci',
    "Regola l'altezza del sedile in modo che le ginocchia siano leggermente piegate, con le punte dei piedi sulla pedana e i talloni che pendono dal bordo. Afferra le maniglie per stabilità. Spingi attraverso le punte dei piedi per sollevare i talloni il più in alto possibile, fai una pausa in cima, poi abbassa lentamente i talloni.",
    [
      'Sali il più possibile sulle punte dei piedi.',
      'Fai una pausa in cima contraendo bene i polpacci.',
      'Scendi con controllo fino a sentire un leggero allungamento.',
    ],
    ['Non usare rimbalzi per generare slancio.', 'Non ridurre il range di movimento per fare più ripetizioni.', 'Non bloccare le ginocchia in modo rigido.']
  ),
  // No exact "clamshell" (side-lying, band above the knees) clip exists in
  // the source dataset — this is the closest real match (same muscle
  // group, same band-resistance equipment, same seated-and-open-the-knees
  // pattern), so the exercise's displayed name was adjusted in
  // exercise-library.ts to match what the GIF actually shows rather than
  // mislabeling a different movement as "clamshell".
  'clamshell-elastico': entry(
    'videos/3006-0xDpB4L.gif',
    'Abduttori, glutei',
    "Siediti su una sedia o panca con la schiena dritta e i piedi a terra. Avvolgi l'elastico attorno alle cosce, appena sopra le ginocchia. Tieni le mani sui lati della sedia per supporto. Coinvolgi gli abduttori e allarga lentamente le ginocchia contro la resistenza dell'elastico, poi riportale lentamente insieme.",
    [
      "Muovi le ginocchia con controllo contro la resistenza dell'elastico.",
      'Mantieni la schiena dritta e i piedi ben appoggiati a terra.',
      'Fai una breve pausa a fine corsa contraendo i glutei.',
    ],
    [
      'Non usare slancio per aprire le ginocchia.',
      'Non inclinare il busto per compensare lo sforzo.',
      "Non lasciare che l'elastico si allenti tra una ripetizione e l'altra.",
    ]
  ),
};

export function getExerciseMedia(exerciseId: string): ExerciseMedia | undefined {
  return EXERCISE_MEDIA[exerciseId];
}
