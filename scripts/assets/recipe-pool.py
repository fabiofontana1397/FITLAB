# The recipe pool as data: generates the DISHES block of src/lib/planning/fitlab/dishes.ts, the recipes of recipes.ts,
# the photo map of dish-images.ts and the ChatGPT prompts of the photos still to make (see docs/MEAL-IMAGES.md).
# Writes to /tmp/work (create it first); paste the blocks into the files, then run npm run recipes:check and meals:check.
# The files in src/ are the source of truth: keep this script in step when a recipe changes.
import json

PASTA = ['Pasta', 'Pasta integrale', 'Pasta di riso', 'Pasta di mais']   # look the same on the plate; gluten-free ones keep pasta for coeliacs
PASTA_INT = ['Pasta integrale', 'Pasta', 'Pasta di riso', 'Pasta di mais']
RISO = ['Riso', 'Riso basmati', 'Riso integrale']
RISO_INT = ['Riso integrale', 'Riso', 'Riso basmati']
BASMATI = ['Riso basmati', 'Riso', 'Riso integrale']
PANE = ['Pane integrale', 'Pane di segale']
PATATE = ['Patate']
DOLCI = ['Patate dolci']
GALL = ['Gallette di riso', 'Gallette di mais']
GREEK = ['Yogurt greco 0%', 'Yogurt greco 2%']
OATS = ["Fiocchi d'avena", 'Avena istantanea']
MILK = ['Latte vaccino', 'Latte senza lattosio', 'Bevanda di soia non zuccherata']
MOZZ = ['Mozzarella light', 'Mozzarella']
CARNE = ['Limone', 'Rosmarino', 'Pepe nero']
POMO = ['Passata di pomodoro', 'Basilico']
PESCE = ['Limone', 'Prezzemolo', 'Pepe nero']

# (id, name, base, protein, veg, aromas, look, photo, extra)
L = [
 ('L01', 'Pasta al pomodoro con pollo e zucchine', PASTA, ['Petto di pollo'], 'Zucchine', POMO, 'penne al pomodoro con bocconcini di petto di pollo e zucchine a rondelle, foglie di basilico', 'pl023'),
 ('L02', 'Pasta con tonno e pomodorini', PASTA, ['Tonno al naturale'], 'Pomodori', ['Basilico', 'Origano'], 'penne con tonno al naturale a pezzi e pomodorini tagliati a metà, basilico', None),
 ('L03', 'Pasta al pomodoro con ricotta e melanzane', PASTA, ['Ricotta magra'], 'Melanzane', POMO, 'penne al sugo di pomodoro con cubetti di melanzane e ricotta sbriciolata sopra, basilico', 'x304'),
 ('L04', 'Pasta al ragù di manzo con insalata', PASTA, ['Macinato di manzo magro'], 'Lattuga', POMO, 'rigatoni al ragù di carne macinata di manzo al pomodoro, con un mucchietto di insalata di lattuga a lato nello stesso piatto', None),
 ('L05', 'Pasta con tacchino e broccoli', PASTA, ['Petto di tacchino'], 'Broccoli', ['Aglio', 'Pepe nero'], 'orecchiette con cimette di broccoli e straccetti di petto di tacchino', None),
 ('L06', 'Insalata di pasta con mozzarella e pomodorini', PASTA, MOZZ, 'Pomodori', ['Basilico', 'Origano'], 'insalata di pasta fredda (fusilli) con bocconcini di mozzarella, pomodorini a metà e basilico', None),
 ('L07', 'Pasta integrale con pollo e peperoni', PASTA_INT, ['Petto di pollo'], 'Peperoni', CARNE, 'penne integrali con straccetti di petto di pollo e peperoni rossi e gialli a listarelle', None),
 ('L08', 'Pasta integrale con tonno e fagiolini', PASTA_INT, ['Tonno al naturale'], 'Fagiolini', ['Limone', 'Prezzemolo'], 'fusilli integrali con tonno al naturale a pezzi e fagiolini tagliati', None),
 ('L09', 'Riso con pollo e zucchine', RISO, ['Petto di pollo'], 'Zucchine', CARNE, 'riso bianco con bocconcini di petto di pollo e zucchine a cubetti saltate', None),
 ('L10', 'Insalata di riso con tonno e pomodorini', RISO, ['Tonno al naturale'], 'Pomodori', ['Basilico', 'Origano'], 'insalata di riso freddo con tonno al naturale e pomodorini a cubetti, basilico', None),
 ('L11', 'Riso con tacchino e carote', RISO, ['Petto di tacchino'], 'Carote', CARNE, 'riso bianco con bocconcini di petto di tacchino e carote a rondelle', None),
 ('L12', 'Riso con manzo e peperoni', RISO, ['Manzo magro'], 'Peperoni', ['Pepe nero', 'Paprika'], 'riso bianco con straccetti di manzo e peperoni rossi a listarelle saltati', None),
 ('L13', 'Insalata di riso con mozzarella e pomodorini', RISO, MOZZ, 'Pomodori', ['Basilico', 'Origano'], 'insalata di riso freddo con bocconcini di mozzarella e pomodorini, basilico', None),
 ('L14', 'Riso basmati con pollo al curry e zucchine', BASMATI, ['Petto di pollo'], 'Zucchine', ['Curry', 'Curcuma'], 'riso basmati con bocconcini di pollo al curry giallo e zucchine a cubetti', None),
 ('L15', 'Riso integrale con hamburger di pollo e insalata', RISO_INT, ['Hamburger di pollo magro'], 'Lattuga', CARNE, 'un hamburger di pollo alla piastra (senza panino) con riso integrale e insalata di lattuga, nello stesso piatto', None),
 ('L16', 'Cous cous con pollo e peperoni', ['Cous cous'], ['Petto di pollo'], 'Peperoni', ['Paprika', 'Prezzemolo'], 'cous cous con bocconcini di pollo e peperoni a cubetti, prezzemolo', None),
 ('L17', 'Cous cous con tonno e zucchine', ['Cous cous'], ['Tonno al naturale'], 'Zucchine', ['Limone', 'Menta'] if False else ['Limone', 'Prezzemolo'], 'cous cous con tonno al naturale a pezzi e zucchine a cubetti, prezzemolo', None),
 ('L18', 'Cous cous con tacchino e melanzane', ['Cous cous'], ['Petto di tacchino'], 'Melanzane', ['Paprika', 'Prezzemolo'], 'cous cous con bocconcini di tacchino e melanzane a cubetti grigliate', None),
 ('L19', 'Farro con tonno e pomodorini', ['Farro'], ['Tonno al naturale'], 'Pomodori', ['Basilico', 'Origano'], 'insalata di farro con tonno al naturale e pomodorini a metà, basilico', None),
 ('L20', 'Farro con pollo e zucchine', ['Farro'], ['Petto di pollo'], 'Zucchine', CARNE, 'farro con bocconcini di pollo e zucchine a cubetti', None),
 ('L21', 'Orzo con tacchino e carote', ['Orzo'], ['Petto di tacchino'], 'Carote', CARNE, 'orzo perlato con bocconcini di tacchino e carote a cubetti', None),
 ('L22', 'Insalata di orzo con mozzarella e pomodorini', ['Orzo'], MOZZ, 'Pomodori', ['Basilico'], 'insalata di orzo perlato con bocconcini di mozzarella e pomodorini, basilico', None),
 ('L23', 'Frittata di zucchine con patate', PATATE, ['Uova intere'], 'Zucchine', ['Prezzemolo', 'Pepe nero'], 'frittata dorata di zucchine tagliata a spicchi con patate', 'x320'),
 ('L24', 'Pollo al limone con patate e fagiolini', PATATE, ['Petto di pollo'], 'Fagiolini', ['Limone', 'Rosmarino'], 'petto di pollo alla griglia a fette con patate al forno e fagiolini', 'pollo-patate-insalata'),
 ('L25', 'Hamburger di manzo con patate e insalata', PATATE, ['Hamburger di manzo magro'], 'Lattuga', CARNE, 'un hamburger di manzo alla piastra (senza panino) con patate al forno a spicchi e insalata di lattuga', None),
 ('L26', 'Lonza con patate e spinaci', PATATE, ['Lonza di maiale magra'], 'Spinaci', CARNE, 'fettine di lonza di maiale alla piastra con patate al forno a cubetti e spinaci saltati', None),
 ('L27', 'Tacchino con patate e carote', PATATE, ['Petto di tacchino'], 'Carote', CARNE, 'fettine di petto di tacchino alla piastra con patate e carote al forno', None),
 ('L28', 'Hamburger di tacchino al pomodoro con pane e spinaci', PANE, ['Hamburger di tacchino magro'], 'Spinaci', POMO, 'un hamburger di tacchino con salsa di pomodoro sopra, una fetta di pane integrale e spinaci saltati', 'x315'),
 ('L29', 'Pollo alla griglia con pane integrale e insalata', PANE, ['Petto di pollo'], 'Lattuga', CARNE, 'petto di pollo alla griglia a fette con due fette di pane integrale e insalata di lattuga', None),
 ('L30', 'Tonno con pane integrale e pomodori', PANE, ['Tonno al naturale'], 'Pomodori', ['Origano', 'Basilico'], 'tonno al naturale in scaglie con pomodori a spicchi, origano e due fette di pane integrale', None),
 ('L31', 'Uova strapazzate con pane integrale e spinaci', PANE, ['Uova intere'], 'Spinaci', ['Pepe nero'], 'uova strapazzate morbide con spinaci saltati e una fetta di pane integrale tostato', None),
 ('L32', 'Fiocchi di latte con pane di segale e cetrioli', ['Pane di segale', 'Pane integrale'], ['Fiocchi di latte'], 'Cetrioli', ['Pepe nero', 'Prezzemolo'], 'una ciotolina di fiocchi di latte con cetrioli a rondelle e due fette di pane di segale scuro', None),
 ('L33', 'Gallette di riso con tonno e pomodori', GALL, ['Tonno al naturale'], 'Pomodori', ['Origano'], 'gallette di riso con tonno al naturale e pomodori a fette sopra', None),
 ('L34', 'Gallette di riso con pollo e insalata', GALL, ['Petto di pollo'], 'Lattuga', CARNE, 'petto di pollo alla griglia a fette con insalata di lattuga e gallette di riso a lato', None),
 ('L35', 'Insalata di ceci con tonno e pomodori', ['Ceci'], ['Tonno al naturale'], 'Pomodori', ['Prezzemolo', 'Limone'], 'insalata di ceci con tonno al naturale e pomodorini a cubetti, prezzemolo', None),
 ('L36', 'Ceci con pollo e spinaci', ['Ceci'], ['Petto di pollo'], 'Spinaci', ['Paprika', 'Aglio'], 'ceci saltati con bocconcini di pollo e spinaci', None),
 ('L37', 'Lenticchie con uova sode e carote', ['Lenticchie'], ['Uova intere'], 'Carote', ['Rosmarino', 'Pepe nero'], 'lenticchie in umido con carote a cubetti e due uova sode tagliate a metà', None),
 ('L38', 'Fagioli cannellini con tonno e insalata', ['Fagioli cannellini'], ['Tonno al naturale'], 'Lattuga', ['Prezzemolo', 'Limone'], 'fagioli cannellini con tonno al naturale e insalata di lattuga', None),
 ('L39', 'Fagioli borlotti con tacchino e zucchine', ['Fagioli borlotti'], ['Petto di tacchino'], 'Zucchine', ['Rosmarino', 'Salvia'], 'fagioli borlotti con bocconcini di tacchino e zucchine a cubetti', None),
 ('L40', 'Patate dolci con pollo e broccoli', DOLCI, ['Petto di pollo'], 'Broccoli', CARNE, 'patate dolci arancioni al forno a cubetti con petto di pollo a fette e cimette di broccoli', None),
 ('L41', 'Riso con vitello e funghi', RISO, ['Vitello magro'], 'Funghi', ['Prezzemolo', 'Aglio'], 'riso bianco con straccetti di vitello e funghi champignon trifolati, prezzemolo', None),
 ('L42', 'Pasta integrale con ricotta e spinaci', PASTA_INT, ['Ricotta magra'], 'Spinaci', ['Pepe nero'], 'penne integrali condite con crema di ricotta e spinaci', None),
 ('L43', 'Farro con fiocchi di latte e pomodorini', ['Farro'], ['Fiocchi di latte'], 'Pomodori', ['Basilico'], 'insalata di farro con fiocchi di latte e pomodorini, basilico', None),
 ('L44', 'Straccetti di manzo con patate e rucola', PATATE, ['Manzo magro'], 'Rucola', CARNE, 'straccetti di manzo scottati su letto di rucola con patate al forno a cubetti', 'x325'),
 ('L45', 'Riso con lonza e peperoni', RISO, ['Lonza di maiale magra'], 'Peperoni', CARNE, 'riso bianco con bocconcini di lonza di maiale e peperoni a listarelle', None),
 ('L46', 'Cous cous con hamburger di pollo e pomodori', ['Cous cous'], ['Hamburger di pollo magro'], 'Pomodori', CARNE, 'un hamburger di pollo alla piastra con cous cous e pomodori a spicchi', None),
 ('L47', 'Gallette di mais con mozzarella e pomodori', ['Gallette di mais', 'Gallette di riso'], MOZZ, 'Pomodori', ['Basilico', 'Origano'], 'gallette di mais con fette di mozzarella e pomodoro, basilico', None),
 ('L48', 'Pasta con pollo e funghi', PASTA, ['Petto di pollo'], 'Funghi', ['Prezzemolo', 'Aglio'], 'penne con bocconcini di pollo e funghi champignon trifolati, prezzemolo', None),
 ('L49', 'Riso con tacchino e asparagi', RISO, ['Petto di tacchino'], 'Asparagi', CARNE, 'riso bianco con bocconcini di tacchino e punte di asparagi', None),
 ('L50', 'Uova sode con patate e fagiolini', PATATE, ['Uova intere'], 'Fagiolini', ['Prezzemolo', 'Pepe nero'], 'insalata di patate lesse a cubetti, fagiolini e due uova sode tagliate a metà', None),
]

D = [
 ('D01', 'Orata al forno con patate e fagiolini', PATATE, ['Orata'], 'Fagiolini', PESCE, None, 'pl028'),
 ('D02', 'Manzo con patate al forno e cavolo nero', PATATE, ['Manzo magro'], 'Cavolo nero', CARNE, None, 'pl030'),
 ('D03', 'Cous cous con gamberi e zucchine', ['Cous cous'], ['Gamberi'], 'Zucchine', PESCE, None, 'pl031'),
 ('D04', 'Spezzatino di manzo con patate e carote', PATATE, ['Manzo magro'], 'Carote', ['Rosmarino', 'Passata di pomodoro'], None, 'x309'),
 ('D05', 'Salmone con cous cous e zucchine', ['Cous cous'], ['Salmone'], 'Zucchine', PESCE, None, 'salmone-cereali-zucchine'),
 ('D06', 'Hamburger di merluzzo con patate e insalata', PATATE, ['Hamburger di merluzzo'], 'Lattuga', PESCE, None, 'x319'),
 ('D07', 'Pasta con gamberi e zucchine', PASTA, ['Gamberi'], 'Zucchine', ['Aglio', 'Prezzemolo'], None, 'x321'),
 ('D08', 'Lonza con patate e cavolo nero', PATATE, ['Lonza di maiale magra'], 'Cavolo nero', CARNE, None, 'x327'),
 ('D09', 'Pasta con sardine e finocchi', PASTA, ['Sardine'], 'Finocchi', ['Aglio', 'Prezzemolo'], None, 'x317'),
 ('D10', 'Risotto alla zucca con gamberi', RISO, ['Gamberi'], 'Zucca', ['Prezzemolo'], None, 'x301'),
 ('D11', 'Riso integrale con salmone e broccoli', RISO_INT, ['Salmone'], 'Broccoli', PESCE, None, 'pl024'),
 ('D12', 'Merluzzo con patate e spinaci', PATATE, ['Merluzzo'], 'Spinaci', PESCE, 'filetto di merluzzo al forno con patate a cubetti e spinaci saltati, fetta di limone', None),
 ('D13', 'Riso con merluzzo e zucchine', RISO, ['Merluzzo'], 'Zucchine', PESCE, 'riso bianco con pezzetti di merluzzo e zucchine a cubetti, prezzemolo', None),
 ('D14', 'Pasta con salmone e zucchine', PASTA, ['Salmone'], 'Zucchine', ['Pepe nero', 'Prezzemolo'], 'farfalle con cubetti di salmone e zucchine a rondelle', None),
 ('D15', 'Pasta con merluzzo e pomodorini', PASTA, ['Merluzzo'], 'Pomodori', ['Aglio', 'Prezzemolo'], 'spaghetti con merluzzo a pezzetti e pomodorini, prezzemolo', None),
 ('D16', 'Trota al forno con patate e fagiolini', PATATE, ['Trota'], 'Fagiolini', PESCE, 'filetto di trota al forno con patate a spicchi e fagiolini, fetta di limone', None),
 ('D17', 'Trota con riso basmati e asparagi', BASMATI, ['Trota'], 'Asparagi', PESCE, 'filetto di trota con riso basmati e asparagi verdi', None),
 ('D18', 'Salmone con patate dolci e spinaci', DOLCI, ['Salmone'], 'Spinaci', PESCE, 'filetto di salmone al forno con patate dolci arancioni a cubetti e spinaci saltati', None),
 ('D19', 'Sgombro con patate e insalata', PATATE, ['Sgombro'], 'Lattuga', PESCE, 'filetti di sgombro alla griglia con patate lesse e insalata di lattuga', None),
 ('D20', 'Orata con riso e zucchine', RISO, ['Orata'], 'Zucchine', PESCE, 'filetto di orata al forno con riso bianco e zucchine grigliate', None),
 ('D21', 'Gnocchi al pomodoro con mozzarella e melanzane', ['Gnocchi di patate'], MOZZ, 'Melanzane', POMO, 'gnocchi di patate al sugo di pomodoro con mozzarella filante e cubetti di melanzane, basilico', None),
 ('D22', 'Pasta con tacchino e cavolfiore', PASTA, ['Petto di tacchino'], 'Cavolfiore', ['Aglio', 'Pepe nero'], 'penne con bocconcini di tacchino e cimette di cavolfiore', None),
 ('D23', 'Riso con pollo e broccoli', RISO, ['Petto di pollo'], 'Broccoli', CARNE, 'riso bianco con bocconcini di pollo e cimette di broccoli', None),
 ('D24', 'Vitello con patate e funghi', PATATE, ['Vitello magro'], 'Funghi', ['Prezzemolo', 'Aglio'], 'fettine di vitello con funghi champignon trifolati e patate al forno', None),
 ('D25', 'Pasta al ragù di manzo con melanzane', PASTA, ['Macinato di manzo magro'], 'Melanzane', POMO, 'pasta corta al ragù di manzo con cubetti di melanzane, basilico', None),
 ('D26', 'Ceci con merluzzo e pomodori', ['Ceci'], ['Merluzzo'], 'Pomodori', ['Rosmarino', 'Aglio'], 'ceci in umido al pomodoro con un filetto di merluzzo', None),
 ('D27', 'Lenticchie con tacchino e carote', ['Lenticchie'], ['Petto di tacchino'], 'Carote', ['Rosmarino', 'Pepe nero'], 'lenticchie in umido con carote e fettine di petto di tacchino', None),
 ('D28', 'Fagioli cannellini con gamberi e zucchine', ['Fagioli cannellini'], ['Gamberi'], 'Zucchine', ['Rosmarino', 'Aglio'], 'fagioli cannellini con gamberi saltati e zucchine a cubetti', None),
 ('D29', 'Farro con salmone e asparagi', ['Farro'], ['Salmone'], 'Asparagi', PESCE, 'farro con cubetti di salmone e punte di asparagi', None),
 ('D30', 'Orzo con merluzzo e zucchine', ['Orzo'], ['Merluzzo'], 'Zucchine', PESCE, 'orzo perlato con pezzetti di merluzzo e zucchine a cubetti', None),
 ('D31', 'Hamburger di salmone con patate e insalata', PATATE, ['Hamburger di salmone'], 'Lattuga', PESCE, 'un hamburger di salmone alla piastra (senza panino) con patate al forno e insalata di lattuga', None),
 ('D32', 'Frittata di spinaci con patate', PATATE, ['Uova intere'], 'Spinaci', ['Pepe nero'], 'frittata di spinaci tagliata a spicchi con patate al forno', None),
 ('D33', 'Pasta con uova e zucchine', PASTA, ['Uova intere'], 'Zucchine', ['Pepe nero'], 'spaghetti cremosi con uova e zucchine a rondelle (carbonara di zucchine senza guanciale), pepe nero', None),
 ('D34', 'Pasta integrale con tonno e broccoli', PASTA_INT, ['Tonno al naturale'], 'Broccoli', ['Aglio', 'Peperoncino'], 'penne integrali con tonno al naturale e cimette di broccoli', None),
 ('D35', 'Pollo con patate e peperoni', PATATE, ['Petto di pollo'], 'Peperoni', CARNE, 'bocconcini di pollo con peperoni rossi e gialli e patate al forno', None),
 ('D36', 'Tacchino con patate dolci e cavolini', DOLCI, ['Petto di tacchino'], 'Cavolini di Bruxelles', CARNE, 'fettine di tacchino con patate dolci arancioni a cubetti e cavolini di Bruxelles', None),
 ('D37', 'Hamburger di manzo con riso e insalata', RISO, ['Hamburger di manzo magro'], 'Lattuga', CARNE, 'un hamburger di manzo alla piastra (senza panino) con riso bianco e insalata di lattuga', None),
 ('D38', 'Merluzzo con cous cous e pomodorini', ['Cous cous'], ['Merluzzo'], 'Pomodori', PESCE, 'filetto di merluzzo con cous cous e pomodorini', None),
 ('D39', 'Tagliata di manzo con patate e rucola', PATATE, ['Manzo magro'], 'Rucola', CARNE, 'tagliata di manzo a fette su rucola con patate al forno a spicchi', None),
 ('D40', 'Gnocchi con salmone e spinaci', ['Gnocchi di patate'], ['Salmone'], 'Spinaci', ['Pepe nero'], 'gnocchi di patate con cubetti di salmone e spinaci', None),
 ('D41', 'Pasta con orata e pomodorini', PASTA, ['Orata'], 'Pomodori', ['Aglio', 'Prezzemolo'], 'spaghetti con filetto di orata a pezzi e pomodorini, prezzemolo', None),
 ('D42', 'Riso con gamberi e asparagi', RISO, ['Gamberi'], 'Asparagi', PESCE, 'risotto con gamberi e punte di asparagi', None),
 ('D43', 'Pasta con ricotta e zucchine', PASTA, ['Ricotta magra'], 'Zucchine', ['Basilico', 'Pepe nero'], 'pasta corta con crema di ricotta e zucchine a rondelle, basilico', None),
 ('D44', 'Pollo arrosto con patate e carote', PATATE, ['Petto di pollo'], 'Carote', CARNE, 'petto di pollo arrosto a fette con patate e carote al forno', None),
 ('D45', 'Lonza con riso e spinaci', RISO, ['Lonza di maiale magra'], 'Spinaci', CARNE, 'fettine di lonza di maiale con riso bianco e spinaci saltati', None),
 ('D46', 'Hamburger di pollo con patate dolci e zucchine', DOLCI, ['Hamburger di pollo magro'], 'Zucchine', CARNE, 'un hamburger di pollo alla piastra con patate dolci arancioni al forno e zucchine grigliate', None),
 ('D47', 'Farro con tacchino e melanzane', ['Farro'], ['Petto di tacchino'], 'Melanzane', CARNE, 'farro con bocconcini di tacchino e melanzane a cubetti', None),
 ('D48', 'Orzo con pollo e carote', ['Orzo'], ['Petto di pollo'], 'Carote', CARNE, 'orzo perlato con bocconcini di pollo e carote a cubetti', None),
 ('D49', 'Pasta con sgombro e pomodorini', PASTA, ['Sgombro'], 'Pomodori', ['Aglio', 'Prezzemolo'], 'pasta corta con filetti di sgombro e pomodorini, prezzemolo', None),
 ('D50', 'Merluzzo con riso basmati e carote', BASMATI, ['Merluzzo'], 'Carote', PESCE, 'filetto di merluzzo al vapore con riso basmati e carote a rondelle', None),
]

# vegan reserve: legumes as the secondo, next to a cereal (only when the person eats no meat, fish, eggs or dairy)
R = [
 ('R01', 'Riso con lenticchie e spinaci', RISO, ['Lenticchie'], 'Spinaci', ['Pepe nero'], 'riso bianco con lenticchie e spinaci saltati', None),
 ('R02', 'Pasta e ceci con zucchine', PASTA, ['Ceci'], 'Zucchine', ['Rosmarino'], 'pasta corta con ceci e zucchine a cubetti, rosmarino', None),
 ('R03', 'Cous cous con ceci e peperoni', ['Cous cous'], ['Ceci'], 'Peperoni', ['Paprika'], 'cous cous con ceci e peperoni a cubetti', None),
 ('R04', 'Farro con fagioli e pomodori', ['Farro'], ['Fagioli borlotti'], 'Pomodori', ['Basilico'], 'farro con fagioli borlotti e pomodorini, basilico', None),
]

# breakfast / snack: (id, kinds, name, fields, look, photo)
B = [
 ('B01', 'Porridge d’avena con yogurt greco e frutti di bosco', dict(base=OATS, protein=GREEK, sides=[['Frutti di bosco', 'Mirtilli']], accessories=[(MILK, 150, 10)], aromas=['Cannella']), None, 'pl001'),
 ('B02', 'Porridge d’avena con albumi e burro di arachidi', dict(base=OATS, protein=["Albume d'uovo"], fat=['Burro di arachidi 100%'], fatRequired=True, accessories=[(MILK, 100, 10)], aromas=['Cannella']), None, 'pl003'),
 ('B03', 'Porridge d’avena con yogurt greco e banana', dict(base=OATS, protein=GREEK, sides=[['Banana']], accessories=[(MILK, 150, 10)], aromas=['Cannella']), "ciotola di porridge d'avena con un cucchiaio di yogurt greco bianco e fette di banana", None),
 ('B04', 'Avocado toast con uova', dict(base=PANE, protein=['Uova intere'], fat=['Avocado'], fatRequired=True, aromas=['Limone', 'Pepe nero']), None, 'pl021'),
 ('B05', 'Uova strapazzate con pane integrale e arancia', dict(base=PANE, protein=['Uova intere'], sides=[['Arancia']], aromas=['Pepe nero', 'Prezzemolo']), None, 'x103'),
 ('B06', 'Frittata di albumi con pane integrale', dict(base=PANE, protein=["Albume d'uovo"], oil=True, aromas=['Pepe nero', 'Prezzemolo']), 'una frittata bianca di soli albumi piegata, con prezzemolo, e una fetta di pane integrale tostato', None),
 ('B07', 'Pane integrale con ricotta e marmellata', dict(base=PANE, protein=['Ricotta magra'], spread=['Marmellata light']), None, 'pl005'),
 ('B08', 'Fette biscottate con yogurt greco e marmellata', dict(base=['Fette biscottate integrali'], protein=GREEK, spread=['Marmellata light']), None, 'pl009'),
 ('B09', 'Yogurt greco con muesli e kiwi', dict(base=['Muesli'], protein=GREEK, sides=[['Kiwi']], fat=['Mandorle']), None, 'pl004'),
 ('B10', 'Yogurt greco con cereali integrali e fragole', dict(base=['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti'], protein=GREEK, sides=[['Fragole']]), 'ciotola di yogurt greco bianco con cereali integrali croccanti e fragole a fette', None),
 ('B11', 'Overnight oats con yogurt greco e banana', dict(base=OATS, protein=GREEK + ['Skyr'], sides=[['Banana']], fat=['Semi di chia'], aromas=['Cannella']), None, 'x104'),
 ('B12', 'Latte con cereali integrali, banana e mandorle', dict(base=['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti'], protein=MILK, sides=[['Banana']], fat=['Mandorle']), None, 'x101'),
 ('B13', 'Pancake d’avena con yogurt e banana', dict(base=["Fiocchi d'avena"], protein=['Uova intere', "Albume d'uovo"], sides=[['Banana']], accessories=[(MILK, 50, 10), (GREEK, 100, 10)]), None, 'pl007'),
 ('B14', 'Pane di segale con fiocchi di latte e marmellata', dict(base=['Pane di segale', 'Pane integrale'], protein=['Fiocchi di latte'], spread=['Marmellata light']), None, 'pl008'),
 ('B15', 'Skyr con banana e semi di chia', dict(protein=['Skyr', 'Yogurt greco 0%'], sides=[['Banana']], fat=['Semi di chia']), None, 'pl013'),
 ('B16', 'Kefir con avena, mela e noci', dict(base=["Fiocchi d'avena"], protein=['Kefir'], sides=[['Mela']], fat=['Noci'], aromas=['Cannella']), None, 'pl010'),
 ('B17', 'Gallette di riso con ricotta, banana e burro di mandorle', dict(base=['Gallette di riso', 'Gallette di mais'], protein=['Ricotta magra'], sides=[['Banana']], fat=['Burro di mandorle 100%']), None, 'x102'),
 ('B18', 'Yogurt greco con avena e frutti di bosco', dict(base=OATS, protein=GREEK, sides=[['Frutti di bosco', 'Mirtilli']], aromas=['Cannella']), "ciotola di yogurt greco bianco con fiocchi d'avena e frutti di bosco misti (mirtilli, lamponi, more)", None),
 ('B19', 'Porridge con bevanda di soia, banana e burro di arachidi', dict(base=OATS, protein=['Bevanda di soia non zuccherata', 'Bevanda di mandorla non zuccherata'], sides=[['Banana']], fat=['Burro di arachidi 100%'], fatRequired=True, aromas=['Cannella'], reserve=True), None, 'x106'),
 ('B20', 'Pane integrale con burro di arachidi e mela', dict(base=PANE, protein=[], sides=[['Mela']], fat=['Burro di arachidi 100%', 'Burro di mandorle 100%'], fatRequired=True, reserve=True), 'due fette di pane integrale spalmate di burro di arachidi, con spicchi di mela a lato', None),
]

S = [
 ('S01', 'Yogurt greco con frutti di bosco e mandorle', dict(protein=GREEK, sides=[['Frutti di bosco', 'Mirtilli']], fat=['Mandorle']), None, 'pl012'),
 ('S02', 'Yogurt greco con mela e noci', dict(protein=GREEK, sides=[['Mela']], fat=['Noci']), 'ciotola di yogurt greco bianco con cubetti di mela rossa e gherigli di noci', None),
 ('S03', 'Yogurt greco con avena e cannella', dict(base=OATS, protein=GREEK, aromas=['Cannella']), "ciotola di yogurt greco bianco con fiocchi d'avena e una spolverata di cannella", None),
 ('S04', 'Yogurt greco con noci e miele', dict(protein=GREEK, fat=['Noci'], spread=['Miele']), None, 'x202'),
 ('S05', 'Kefir con frutti di bosco e semi di lino', dict(protein=['Kefir', 'Yogurt magro'], sides=[['Frutti di bosco', 'Mirtilli']], fat=['Semi di lino']), None, 'pl020'),
 ('S06', 'Pan bauletto con marmellata', dict(base=['Pan bauletto', 'Pane integrale'], protein=[], spread=['Marmellata light'], portable=True), 'due fette di pan bauletto morbido spalmate di marmellata di fragole', None),
 ('S07', 'Panino con fesa di tacchino', dict(base=['Pan bauletto', 'Pane integrale'], protein=['Fesa di tacchino affettata'], portable=True), 'un panino di pane morbido tagliato a metà farcito con fette di fesa di tacchino', None),
 ('S08', 'Bresaola con pane e rucola', dict(base=PANE, protein=['Bresaola'], sides=[['Rucola']], aromas=['Limone', 'Pepe nero'], portable=True), None, 'pl015'),
 ('S09', 'Pane integrale con ricotta', dict(base=PANE, protein=['Ricotta magra'], aromas=['Origano', 'Pepe nero']), None, 'pl014'),
 ('S10', 'Crackers con tonno e pomodorini', dict(base=['Crackers integrali'], protein=['Tonno al naturale'], sides=[['Pomodori']], portable=True), None, 'x204'),
 ('S11', 'Pane integrale con fesa di tacchino e avocado', dict(base=PANE, protein=['Fesa di tacchino affettata'], fat=['Avocado'], fatRequired=True, portable=True), None, 'x205'),
 ('S12', 'Hummus di ceci con carote e crackers', dict(base=['Crackers integrali'], protein=['Ceci'], sides=[['Carote']], oil=True, aromas=['Limone', 'Aglio'], portable=True), None, 'pl018'),
 ('S13', 'Pera con parmigiano e noci', dict(protein=['Parmigiano Reggiano'], sides=[['Pera']], fat=['Noci'], portable=True), None, 'x201'),
 ('S14', 'Barretta proteica e mela', dict(protein=['Barretta proteica'], sides=[['Mela']], portable=True), None, 'x206'),
 ('S15', 'Bevanda proteica con banana e mandorle', dict(protein=['Bevanda proteica'], sides=[['Banana']], fat=['Mandorle'], portable=True), None, 'x207'),
 ('S16', 'Bruschetta con mozzarella e pomodori', dict(base=PANE, protein=MOZZ, sides=[['Pomodori']], aromas=['Basilico', 'Origano']), None, 'x208'),
 ('S17', 'Budino proteico con fragole e mandorle', dict(protein=['Budino proteico', 'Yogurt proteico'], sides=[['Fragole']], fat=['Mandorle']), None, 'pl022'),
 ('S18', 'Frutta fresca e frutta secca', dict(protein=[], sides=[['Mela']], fat=['Mandorle', 'Noci'], fatRequired=True, portable=True, reserve=True), None, 'pl019'),
 ('S19', 'Uova sode con pane integrale', dict(base=PANE, protein=['Uova intere'], aromas=['Pepe nero'], portable=True), 'due uova sode sgusciate tagliate a metà con una fetta di pane integrale', None),
 ('S20', 'Latte senza lattosio con cereali integrali', dict(base=['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti'], protein=['Latte senza lattosio', 'Bevanda di soia non zuccherata'], reserve=True), 'ciotola bianca di latte con cereali integrali croccanti', None),
]


def ts_list(xs):
    return '[' + ', '.join(json.dumps(x, ensure_ascii=False) for x in xs) + ']'


out = []
photos = {}
prompts = {}


def main_line(spec, kinds, reserve=False):
    id_, name, base, prot, veg, aromas, look, photo = spec
    lunch = 'lunch' in kinds
    parts = [f"id: '{id_}'", f"kinds: {kinds_ts(kinds)}", f"name: {json.dumps(name, ensure_ascii=False)}", f"base: {ts_list(base)}", f"protein: {ts_list(prot)}", f"sides: [{ts_list([veg])}]", 'oil: true', f"aromas: {ts_list(aromas)}"]
    if lunch: parts.append('portable: true')
    if reserve: parts.append('reserve: true')
    out.append('  { ' + ', '.join(parts) + ' },')
    photos[id_] = photo or id_.lower()
    if not photo: prompts[id_.lower()] = look


def kinds_ts(k):
    return {('lunch',): 'LU', ('dinner',): 'DI', ('lunch', 'dinner'): 'MAIN', ('breakfast',): 'BF', ('snack',): 'SN'}[tuple(k)]


def light_line(spec, kinds):
    id_, name, f, look, photo = spec
    parts = [f"id: '{id_}'", f"kinds: {kinds_ts(kinds)}", f"name: {json.dumps(name, ensure_ascii=False)}"]
    for key in ('base', 'protein'):
        if key in f: parts.append(f"{key}: {ts_list(f[key])}")
    if 'protein' not in f: parts.append('protein: []')
    if 'sides' in f: parts.append('sides: [' + ', '.join(ts_list(s) for s in f['sides']) + ']')
    for key in ('spread', 'fat'):
        if key in f: parts.append(f"{key}: {ts_list(f[key])}")
    if f.get('fatRequired'): parts.append('fatRequired: true')
    if f.get('oil'): parts.append('oil: true')
    if f.get('accessories'): parts.append('accessories: [' + ', '.join(f"{{ foods: {ts_list(a[0])}, grams: {a[1]}, step: {a[2]} }}" for a in f['accessories']) + ']')
    parts.append(f"aromas: {ts_list(f.get('aromas', []))}")
    if f.get('portable'): parts.append('portable: true')
    if f.get('reserve'): parts.append('reserve: true')
    out.append('  { ' + ', '.join(parts) + ' },')
    photos[id_] = photo or id_.lower()
    if not photo: prompts[id_.lower()] = look


out.append('  // =============================================================== COLAZIONE')
for s in B: light_line(s, ['breakfast'])
out.append('')
out.append('  // ================================================================= MERENDA')
for s in S: light_line(s, ['snack'])
out.append('')
out.append('  // ================================================================== PRANZO')
for s in L: main_line(s, ['lunch'])
out.append('')
out.append('  // ==================================================================== CENA')
for s in D: main_line(s, ['dinner'])
out.append('')
out.append('  // ========================================= RISERVA (vegani: legumi accanto a un cereale)')
for s in R: main_line(s, ['lunch', 'dinner'], reserve=True)

open('/tmp/work/dishes_block.ts', 'w').write('\n'.join(out) + '\n')
json.dump(photos, open('/tmp/work/photo_map.json', 'w'), ensure_ascii=False, indent=1)
json.dump(prompts, open('/tmp/work/new_prompts.json', 'w'), ensure_ascii=False, indent=1)
print(len(B), len(S), len(L), len(D), len(R), 'photos new:', len(prompts))

# ------------------------------------------------------------------ recipes --
BASE_COOK = {
 'Pasta': ('Cuoci {b} al dente in abbondante acqua salata e scolala.', 12, ['Pentola', 'Colapasta']),
 'Pasta integrale': ('Cuoci {b} al dente in abbondante acqua salata e scolala.', 12, ['Pentola', 'Colapasta']),
 'Riso': ('Cuoci {b} in acqua bollente salata per il tempo indicato sulla confezione e scolalo.', 16, ['Pentola']),
 'Riso integrale': ('Cuoci {b} in acqua bollente salata per il tempo indicato sulla confezione e scolalo.', 30, ['Pentola']),
 'Riso basmati': ('Sciacqua {b} e cuocilo in acqua bollente salata per circa 10-12 minuti, poi scolalo.', 12, ['Pentola']),
 'Cous cous': ('Metti {b} in una ciotola, coprilo con acqua bollente salata, lascialo riposare 5 minuti coperto e sgranalo con una forchetta.', 5, ['Ciotola', 'Forchetta']),
 'Farro': ('Sciacqua {b} e cuocilo in acqua bollente salata per circa 25 minuti (o il tempo della confezione), poi scolalo.', 25, ['Pentola']),
 'Orzo': ('Sciacqua {b} e cuocilo in acqua bollente salata per circa 25 minuti, poi scolalo.', 25, ['Pentola']),
 'Patate': ('Sbuccia {b} e tagliale a tocchetti; cuocile in forno a 200 °C per 30 minuti con un filo d’olio e rosmarino, oppure lessale per 20-25 minuti.', 30, ['Teglia o pentola']),
 'Patate dolci': ('Sbuccia {b}, tagliale a cubetti e cuocile in forno a 200 °C per 25-30 minuti.', 30, ['Teglia']),
 'Gnocchi di patate': ('Cuoci {b} in acqua bollente salata e scolali appena vengono a galla.', 3, ['Pentola', 'Schiumarola']),
 'Pane integrale': ('Taglia {b} a fette e, se ti piace, tostalo.', 2, ['Coltello']),
 'Pane di segale': ('Taglia {b} a fette e, se ti piace, tostalo.', 2, ['Coltello']),
 'Gallette di riso': ('Tieni pronte {b}: non richiedono preparazione.', 0, []),
 'Gallette di mais': ('Tieni pronte {b}: non richiedono preparazione.', 0, []),
 'Ceci': ('Sciacqua {b} già cotti (in scatola o in vetro) e scaldali in padella o in un pentolino per qualche minuto; se parti da quelli secchi, cuocili prima secondo la confezione.', 8, ['Pentolino']),
 'Lenticchie': ('Sciacqua {b} già cotte e scaldale in un pentolino con un po’ d’acqua e gli aromi; se parti da quelle secche, cuocile prima secondo la confezione.', 10, ['Pentolino']),
 'Fagioli cannellini': ('Sciacqua {b} già cotti e scaldali in un pentolino; se parti da quelli secchi, cuocili prima secondo la confezione.', 8, ['Pentolino']),
 'Fagioli borlotti': ('Sciacqua {b} già cotti e scaldali in un pentolino con gli aromi; se parti da quelli secchi, cuocili prima secondo la confezione.', 8, ['Pentolino']),
}
ART = {'Pasta': 'la pasta', 'Pasta integrale': 'la pasta integrale', 'Riso': 'il riso', 'Riso integrale': 'il riso integrale', 'Riso basmati': 'il riso basmati', 'Cous cous': 'il cous cous', 'Farro': 'il farro', 'Orzo': 'l’orzo', 'Patate': 'le patate', 'Patate dolci': 'le patate dolci', 'Gnocchi di patate': 'gli gnocchi', 'Pane integrale': 'il pane integrale', 'Pane di segale': 'il pane di segale', 'Gallette di riso': 'le gallette di riso', 'Gallette di mais': 'le gallette di mais', 'Ceci': 'i ceci', 'Lenticchie': 'le lenticchie', 'Fagioli cannellini': 'i fagioli cannellini', 'Fagioli borlotti': 'i fagioli borlotti'}
MEAT = {'Petto di pollo': 'il petto di pollo', 'Petto di tacchino': 'il petto di tacchino', 'Manzo magro': 'il manzo', 'Vitello magro': 'il vitello', 'Lonza di maiale magra': 'la lonza'}
FISH = {'Merluzzo': 'il merluzzo', 'Orata': 'l’orata', 'Trota': 'la trota', 'Salmone': 'il salmone', 'Sgombro': 'lo sgombro'}
BURGER = {'Hamburger di pollo magro': 'l’hamburger di pollo', 'Hamburger di tacchino magro': 'l’hamburger di tacchino', 'Hamburger di manzo magro': 'l’hamburger di manzo', 'Hamburger di merluzzo': 'l’hamburger di merluzzo', 'Hamburger di salmone': 'l’hamburger di salmone'}
VEG = {
 'Zucchine': ('Lava le zucchine, tagliale a rondelle o cubetti e saltale in padella per 6-8 minuti.', 8, True),
 'Peperoni': ('Lava i peperoni, elimina semi e filamenti, tagliali a listarelle e cuocili in padella per 10-12 minuti.', 12, True),
 'Melanzane': ('Taglia le melanzane a cubetti e cuocile in padella antiaderente o alla piastra per 10 minuti.', 10, True),
 'Funghi': ('Pulisci i funghi con un panno umido, affettali e trifolali in padella con aglio e prezzemolo per 8-10 minuti.', 10, True),
 'Asparagi': ('Elimina la parte dura degli asparagi e cuoci le punte in padella o al vapore per 8 minuti.', 8, True),
 'Carote': ('Pela le carote, tagliale a rondelle o cubetti e cuocile al vapore o in padella per 10 minuti.', 10, True),
 'Cavolfiore': ('Dividi il cavolfiore in cimette e cuocile al vapore per 10 minuti.', 10, True),
 'Broccoli': ('Dividi i broccoli in cimette e cuocile al vapore o in acqua bollente per 6-8 minuti.', 8, True),
 'Fagiolini': ('Spunta i fagiolini e lessali in acqua bollente salata per 8-10 minuti.', 10, True),
 'Spinaci': ('Lava gli spinaci e saltali in padella per 3-4 minuti, finché appassiscono.', 4, True),
 'Cavolo nero': ('Elimina la costa centrale del cavolo nero, taglia le foglie a strisce e saltale in padella con un po’ d’acqua per 8-10 minuti.', 10, True),
 'Cavolini di Bruxelles': ('Pulisci i cavolini, tagliali a metà e cuocili al vapore o in padella per 12 minuti.', 12, True),
 'Zucca': ('Taglia la zucca a cubetti e cuocila in padella con un po’ d’acqua per 10-12 minuti, finché è morbida.', 12, True),
 'Lattuga': ('Lava e asciuga la lattuga.', 0, False),
 'Rucola': ('Lava e asciuga la rucola.', 0, False),
 'Pomodori': ('Lava i pomodori e tagliali a spicchi o a metà.', 0, False),
 'Cetrioli': ('Lava il cetriolo e taglialo a rondelle sottili.', 0, False),
 'Finocchi': ('Pulisci il finocchio e taglialo a fettine sottili; puoi usarlo crudo o saltarlo in padella per 5 minuti.', 5, False),
}


def protein_step(p, name):
    low = name.lower()
    if p in MEAT:
        art = MEAT[p]
        if 'spezzatino' in low: return ('Taglia il manzo a pezzi, rosolalo in una casseruola, aggiungi la passata e gli aromi e cuoci a fuoco basso, coperto, per circa 40 minuti.', 40, 'Casseruola')
        if 'arrosto' in low: return ('Cuoci il petto di pollo in forno a 200 °C per 20-25 minuti, poi taglialo a fette.', 25, 'Teglia')
        if 'tagliata' in low: return ('Cuoci la bistecca di manzo su una piastra ben calda 2-3 minuti per lato e tagliala a fette.', 6, 'Piastra')
        if 'pizzaiola' in low: return (f'Cuoci {art} in padella con la passata e l’origano per 10 minuti.', 10, 'Padella')
        if 'curry' in low: return (f'Taglia {art} a bocconcini e cuocilo in padella antiaderente per 6-8 minuti con curry e curcuma.', 8, 'Padella antiaderente')
        if any(k in low for k in ('riso', 'pasta', 'cous cous', 'farro', 'orzo', 'ceci', 'fagioli', 'lenticchie', 'straccetti')):
            return (f'Taglia {art} a bocconcini o straccetti e cuocilo in padella antiaderente ben calda per 6-8 minuti.', 8, 'Padella antiaderente')
        return (f'Cuoci {art} alla piastra o in padella antiaderente ben calda, 3-4 minuti per lato.', 8, 'Piastra o padella')
    if p == 'Macinato di manzo magro':
        return ('Rosola il macinato in una casseruola, aggiungi la passata di pomodoro e gli aromi e cuoci a fuoco basso per 15-20 minuti.', 20, 'Casseruola')
    if p in BURGER:
        return (f'Cuoci {BURGER[p]} alla piastra o in padella antiaderente, 4-5 minuti per lato.', 10, 'Piastra o padella')
    if p in FISH:
        art = FISH[p]
        if any(k in low for k in ('pasta', 'riso', 'orzo', 'farro', 'gnocchi', 'cous cous', 'ceci')) and 'filetto' not in low and not low.startswith(p.lower()):
            return (f'Cuoci {art} in padella con un filo d’olio e aglio per 6-8 minuti e spezzettalo, eliminando eventuali lische.', 8, 'Padella')
        return (f'Cuoci {art} in forno a 180 °C per 15-20 minuti (o in padella coperta 8-10 minuti), con limone e prezzemolo.', 18, 'Teglia o padella')
    if p == 'Gamberi':
        return ('Sguscia i gamberi e saltali in padella con aglio per 3-4 minuti.', 4, 'Padella')
    if p == 'Sardine':
        return ('Cuoci le sardine pulite in padella con aglio per 5 minuti e spezzettale.', 5, 'Padella')
    if p == 'Tonno al naturale':
        return ('Sgocciola il tonno e sbriciolalo con una forchetta.', 0, None)
    if p == 'Uova intere':
        if 'frittata' in low: return ('Sbatti le uova con un pizzico di sale e pepe, uniscile alla verdura e cuoci la frittata in padella antiaderente, coperta, 4-5 minuti per lato.', 10, 'Padella antiaderente')
        if 'strapazzate' in low: return ('Sbatti le uova e cuocile in padella antiaderente a fuoco dolce, mescolando, per 2-3 minuti.', 3, 'Padella antiaderente')
        if 'sode' in low: return ('Cuoci le uova in acqua bollente per 9 minuti, raffreddale e sgusciale.', 9, 'Pentolino')
        return ('Sbatti le uova con pepe e, a fuoco spento, mescolale alla pasta calda con le zucchine finché diventano cremose.', 2, None)
    if p in ('Mozzarella light', 'Mozzarella'):
        return ('Taglia la mozzarella a cubetti o a fette.', 0, None)
    if p == 'Ricotta magra':
        return ('Lavora la ricotta con un cucchiaio di acqua di cottura (o di acqua calda) finché è cremosa.', 0, None)
    if p == 'Fiocchi di latte':
        return ('Sgocciola i fiocchi di latte.', 0, None)
    if p in ('Lenticchie', 'Ceci', 'Fagioli borlotti'):
        return (BASE_COOK[p][0].format(b=ART[p]), 8, 'Pentolino')
    raise Exception(p)


RECIPE_LINES = []


def main_recipe(spec, meal):
    id_, name, base, prot, veg, aromas, look, photo = spec
    b, p = base[0], prot[0]
    bstep, bmin, beq = BASE_COOK[b]
    pstep, pmin, peq = protein_step(p, name)
    vstep, vmin, vcooked = VEG[veg]
    low = name.lower()
    steps = [bstep.format(b=ART[b])]
    if 'pomodoro' in low or 'ragù' in low:
        if p != 'Macinato di manzo magro' and 'spezzatino' not in low:
            steps.append('Scalda la passata di pomodoro in un pentolino con il basilico per 5 minuti.')
    if p == 'Uova intere' and ('frittata' in low or pmin <= 2):
        steps += [vstep, pstep]
    else:
        steps += [pstep, vstep]
    cold = 'insalata' in low or 'fredda' in low
    finish = 'Lascia raffreddare il primo e unisci tutti gli ingredienti in una ciotola' if cold else 'Componi il piatto'
    arom = ', '.join(a.lower() for a in aromas if a not in ('Passata di pomodoro',))
    steps.append(f'{finish} e condisci con l’olio extravergine a crudo' + (f' e {arom}.' if arom else '.'))
    cook = max(bmin, pmin, vmin if vcooked else 0) + (5 if bmin and pmin else 0)
    prep = 10 if cook else 8
    eq = []
    for e in beq + ([peq] if peq else []) + (['Padella'] if vcooked and 'Padella' not in ' '.join(beq + [peq or '']) else []):
        if e and e not in eq: eq.append(e)
    if not eq: eq = ['Ciotola', 'Coltello']
    diff = 'Media' if cook >= 30 or 'frittata' in low or 'risotto' in low else 'Facile'
    desc = describe(name, b, p, veg, meal)
    RECIPE_LINES.append(rec(id_, name, meal, prep, cook, diff, eq, desc, steps))


def describe(name, b, p, veg, meal):
    return f'{name}: primo, secondo e contorno in un unico piatto, conditi con olio extravergine d’oliva.'


def rec(id_, name, meal, prep, cook, diff, eq, desc, steps):
    j = lambda x: json.dumps(x, ensure_ascii=False)
    return f"  recipe({{ id: '{id_}', name: {j(name)}, meal: {meal}, prepMinutes: {prep}, cookMinutes: {cook}, difficulty: {j(diff)}, equipment: {j(eq)},\n    description: {j(desc)},\n    steps: {j(steps)} }}),"


LIGHT = {
 'B01': (5, 8, 'Facile', ['Pentolino', 'Ciotola'], 'Porridge cremoso di avena cotta nel latte, con yogurt greco e frutti di bosco.', ['Versa l’avena e il latte in un pentolino.', 'Cuoci a fuoco medio per 5-8 minuti, mescolando, fino a una consistenza cremosa.', 'Trasferisci in una ciotola, aggiungi lo yogurt greco e i frutti di bosco, con un pizzico di cannella.']),
 'B02': (5, 8, 'Media', ['Pentolino', 'Frusta', 'Ciotola'], 'Porridge d’avena cotto nel latte e reso proteico dagli albumi, con burro di arachidi e cannella.', ['Versa avena e latte in un pentolino e cuoci a fuoco basso per 3 minuti.', 'Aggiungi gli albumi poco alla volta, mescolando continuamente, e cuoci ancora 4-5 minuti.', 'Trasferisci in una ciotola e completa con il burro di arachidi e la cannella.']),
 'B03': (5, 8, 'Facile', ['Pentolino', 'Ciotola'], 'Porridge d’avena cotto nel latte, con yogurt greco e banana.', ['Cuoci l’avena nel latte a fuoco medio per 5-8 minuti, mescolando.', 'Trasferisci in una ciotola e aggiungi lo yogurt greco.', 'Completa con la banana a fette e un pizzico di cannella.']),
 'B04': (5, 6, 'Facile', ['Tostapane', 'Padella antiaderente', 'Forchetta'], 'Pane tostato con avocado schiacciato e uova.', ['Tosta il pane.', 'Schiaccia l’avocado con qualche goccia di limone e pepe e spalmalo sul pane.', 'Cuoci le uova in padella antiaderente (all’occhio di bue o strapazzate) o sode, e adagiale sul toast.']),
 'B05': (3, 5, 'Facile', ['Padella antiaderente', 'Spatola'], 'Uova strapazzate morbide con pane tostato e un’arancia.', ['Sbatti le uova con un pizzico di sale e pepe.', 'Cuocile in padella antiaderente a fuoco dolce per 2-3 minuti, mescolando.', 'Servi con il pane tostato e l’arancia a spicchi.']),
 'B06': (3, 6, 'Facile', ['Padella antiaderente', 'Spatola'], 'Frittata leggera di soli albumi con pane tostato.', ['Sbatti gli albumi con sale, pepe e prezzemolo.', 'Scalda l’olio in padella antiaderente, versa gli albumi e cuoci 2-3 minuti per lato.', 'Servi con il pane tostato.']),
 'B07': (5, 3, 'Facile', ['Tostapane', 'Coltello'], 'Pane tostato con ricotta cremosa e marmellata.', ['Tosta il pane.', 'Spalma la ricotta sulle fette.', 'Completa con la marmellata.']),
 'B08': (3, 0, 'Facile', ['Coltello', 'Ciotola'], 'Fette biscottate con yogurt greco e marmellata.', ['Spalma lo yogurt greco sulle fette biscottate (o tienilo in una ciotola a parte).', 'Completa con la marmellata.']),
 'B09': (3, 0, 'Facile', ['Ciotola', 'Coltello'], 'Bowl di yogurt greco con muesli, kiwi e mandorle.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi il muesli e il kiwi a fette.', 'Completa con le mandorle.']),
 'B10': (3, 0, 'Facile', ['Ciotola', 'Coltello'], 'Yogurt greco con cereali integrali e fragole.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi i cereali integrali.', 'Completa con le fragole a fette.']),
 'B11': (5, 0, 'Facile', ['Barattolo', 'Cucchiaio'], 'Avena lasciata in ammollo nello yogurt per tutta la notte, con banana e semi di chia.', ['La sera prima mescola in un barattolo l’avena, lo yogurt e i semi di chia.', 'Chiudi e lascia in frigorifero per tutta la notte.', 'Al mattino completa con la banana a fette e un pizzico di cannella.']),
 'B12': (2, 0, 'Facile', ['Tazza o ciotola', 'Coltello'], 'Latte con cereali integrali, banana e mandorle.', ['Versa il latte in una ciotola.', 'Aggiungi i cereali e la banana a fette.', 'Completa con le mandorle.']),
 'B13': (8, 8, 'Media', ['Frullatore o frusta', 'Padella antiaderente'], 'Pancake d’avena con uova, serviti con yogurt e banana.', ['Frulla l’avena con le uova e il latte fino a un composto liscio.', 'Cuoci piccoli pancake in padella antiaderente calda, 1-2 minuti per lato.', 'Servi con lo yogurt e la banana a fette.']),
 'B14': (3, 2, 'Facile', ['Tostapane', 'Coltello'], 'Pane di segale con fiocchi di latte e marmellata.', ['Tosta il pane di segale.', 'Distribuisci i fiocchi di latte sulle fette.', 'Completa con la marmellata.']),
 'B15': (3, 0, 'Facile', ['Ciotola', 'Coltello'], 'Skyr con banana a fette e semi di chia.', ['Versa lo skyr in una ciotola.', 'Aggiungi la banana a fette.', 'Completa con i semi di chia.']),
 'B16': (5, 0, 'Facile', ['Ciotola', 'Coltello'], 'Kefir con avena, mela a cubetti, noci e cannella.', ['Versa il kefir in una ciotola e aggiungi l’avena.', 'Aggiungi la mela a cubetti e le noci.', 'Completa con la cannella; se preferisci, lascia riposare qualche minuto.']),
 'B17': (3, 0, 'Facile', ['Coltello'], 'Gallette di riso con ricotta, banana e burro di mandorle.', ['Spalma la ricotta sulle gallette.', 'Aggiungi la banana a fette.', 'Completa con il burro di mandorle.']),
 'B18': (3, 0, 'Facile', ['Ciotola'], 'Yogurt greco con avena e frutti di bosco.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi l’avena e mescola.', 'Completa con i frutti di bosco e la cannella.']),
 'B19': (5, 8, 'Facile', ['Pentolino', 'Ciotola'], 'Porridge senza latticini, cotto nella bevanda di soia, con banana e burro di arachidi.', ['Cuoci l’avena nella bevanda vegetale a fuoco medio per 5-8 minuti, mescolando.', 'Trasferisci in una ciotola.', 'Completa con la banana a fette, il burro di arachidi e la cannella.']),
 'B20': (3, 2, 'Facile', ['Tostapane', 'Coltello'], 'Pane integrale tostato con burro di arachidi e una mela.', ['Tosta il pane.', 'Spalma il burro di arachidi.', 'Accompagna con la mela a spicchi.']),
 'S01': (3, 0, 'Facile', ['Ciotola'], 'Yogurt greco con frutti di bosco e mandorle.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi i frutti di bosco e le mandorle.']),
 'S02': (3, 0, 'Facile', ['Ciotola', 'Coltello'], 'Yogurt greco con mela a cubetti e noci.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi la mela a cubetti e le noci.']),
 'S03': (3, 0, 'Facile', ['Ciotola', 'Cucchiaio'], 'Yogurt greco con avena e cannella, senza cottura.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi l’avena e mescola.', 'Completa con la cannella.']),
 'S04': (2, 0, 'Facile', ['Ciotola'], 'Yogurt greco con noci e un filo di miele.', ['Versa lo yogurt greco in una ciotola.', 'Aggiungi le noci e il miele.']),
 'S05': (2, 0, 'Facile', ['Bicchiere o ciotola'], 'Kefir con frutti di bosco e semi di lino.', ['Versa il kefir in un bicchiere o in una ciotola.', 'Aggiungi i frutti di bosco e i semi di lino.']),
 'S06': (2, 0, 'Facile', ['Coltello'], 'Pan bauletto con marmellata, pronto in un minuto.', ['Se ti piace, tosta leggermente le fette.', 'Spalma la marmellata.']),
 'S07': (3, 0, 'Facile', ['Coltello'], 'Panino con fesa di tacchino (affettati: una volta a settimana).', ['Apri il pane.', 'Farcisci con la fesa di tacchino.', 'Per portarlo con te, avvolgilo nella carta o in un contenitore.']),
 'S08': (3, 0, 'Facile', ['Coltello'], 'Bresaola con pane e rucola, con limone e pepe (affettati: una volta a settimana).', ['Lava la rucola.', 'Disponi la bresaola con la rucola, limone e pepe.', 'Accompagna con il pane.']),
 'S09': (3, 2, 'Facile', ['Tostapane', 'Coltello'], 'Pane integrale con ricotta, origano e pepe.', ['Tosta il pane.', 'Spalma la ricotta e completa con origano e pepe.']),
 'S10': (3, 0, 'Facile', ['Coltello'], 'Crackers integrali con tonno e pomodorini.', ['Sgocciola il tonno.', 'Taglia i pomodorini a metà.', 'Distribuisci tonno e pomodorini sui crackers.']),
 'S11': (4, 0, 'Facile', ['Coltello', 'Forchetta'], 'Pane integrale con fesa di tacchino e avocado (affettati: una volta a settimana).', ['Schiaccia o affetta l’avocado e distribuiscilo sul pane.', 'Aggiungi la fesa di tacchino.']),
 'S12': (8, 0, 'Facile', ['Frullatore', 'Coltello'], 'Hummus di ceci con bastoncini di carota e crackers.', ['Frulla i ceci con limone, aglio, l’olio e un po’ d’acqua fino a una crema liscia.', 'Taglia le carote a bastoncini.', 'Servi l’hummus con le carote e i crackers.']),
 'S13': (3, 0, 'Facile', ['Coltello'], 'Pera a spicchi con scaglie di parmigiano e noci.', ['Taglia la pera a spicchi.', 'Accompagna con il parmigiano a scaglie e le noci.']),
 'S14': (1, 0, 'Facile', ['Nessuno'], 'Una barretta proteica e una mela: lo spuntino da portare ovunque.', ['Lava la mela.', 'Accompagnala con la barretta proteica.']),
 'S15': (2, 0, 'Facile', ['Bicchiere'], 'Bevanda proteica con banana e mandorle.', ['Versa la bevanda proteica in un bicchiere.', 'Accompagna con la banana e le mandorle.']),
 'S16': (5, 3, 'Facile', ['Tostapane', 'Coltello'], 'Bruschetta di pane integrale con mozzarella, pomodori e basilico.', ['Tosta il pane.', 'Aggiungi la mozzarella a fette e i pomodori a cubetti.', 'Completa con basilico e origano.']),
 'S17': (2, 0, 'Facile', ['Coltello'], 'Budino proteico con fragole e mandorle.', ['Apri il budino o versalo in una ciotola.', 'Aggiungi le fragole a fette e le mandorle.']),
 'S18': (3, 0, 'Facile', ['Coltello'], 'Spuntino portatile: una mela e una porzione di frutta secca.', ['Lava la mela.', 'Pesa la frutta secca e accompagnala alla mela.']),
 'S19': (2, 9, 'Facile', ['Pentolino'], 'Uova sode con pane integrale: si preparano in anticipo e si portano ovunque.', ['Cuoci le uova in acqua bollente per 9 minuti, raffreddale e sgusciale.', 'Servile con il pane e un pizzico di pepe.']),
 'S20': (2, 0, 'Facile', ['Tazza o ciotola'], 'Latte senza lattosio (o bevanda di soia) con cereali integrali.', ['Versa il latte in una ciotola.', 'Aggiungi i cereali.']),
}
RECIPE_LINES.append('  // =============================================================== COLAZIONE')
for s in B:
    prep, cook, diff, eq, desc, steps = LIGHT[s[0]]
    RECIPE_LINES.append(rec(s[0], s[1], 'BF', prep, cook, diff, eq, desc, steps))
RECIPE_LINES.append('\n  // ================================================================= MERENDA')
for s in S:
    prep, cook, diff, eq, desc, steps = LIGHT[s[0]]
    RECIPE_LINES.append(rec(s[0], s[1], 'SN', prep, cook, diff, eq, desc, steps))
RECIPE_LINES.append('\n  // ================================================================== PRANZO')
for s in L: main_recipe(s, 'LU')
RECIPE_LINES.append('\n  // ==================================================================== CENA')
for s in D: main_recipe(s, 'DI')
RECIPE_LINES.append('\n  // ================================================================= RISERVA')
for s in R: main_recipe(s, 'LU')
open('/tmp/work/recipes_block.ts', 'w').write('\n'.join(RECIPE_LINES) + '\n')
print('recipes', sum(1 for l in RECIPE_LINES if l.startswith('  recipe(')))
