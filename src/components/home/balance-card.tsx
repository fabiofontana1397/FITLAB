import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const ORANGE = '#FF7A00';
const GREEN = '#22B35E';
// "Obiettivo": the brand yellow; text uses a deeper/lighter shade so it stays readable on either theme.
const YELLOW = '#F6B21B';
const YELLOW_TEXT = { light: '#B27800', dark: '#FFC83D' };

// Arc geometry: angles clockwise from 12 o'clock, a wide gap at the bottom
// and a hairline one where orange (burned) meets green (eaten).
const BOTTOM_GAP_DEG = 84;
const MID_GAP_DEG = 12;
const MIN_SWEEP_DEG = 14;
const ARC_START_DEG = 180 + BOTTOM_GAP_DEG / 2;

/** Italian thousands separator, hand-rolled (Hermes doesn't group 'it-IT' reliably). */
function kcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function signed(n: number): string {
  const r = Math.round(n);
  return r === 0 ? '0' : `${r < 0 ? '-' : '+'}${kcal(r)}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, startDeg + sweepDeg);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

export type BalanceStatus = {
  /** 0 = far from the day's target, 1 = right on it. Drives the red → green color. */
  closeness: number;
  /** "DEFICIT CALORICO" / "SURPLUS CALORICO" / "IN PARI". */
  label: string;
  headline: string;
  message: string;
  onTarget: boolean;
  icon: IconName;
};

/**
 * How today's balance (eaten − burned) compares with the plan's daily target
 * (negative = deficit goal, positive = surplus goal, ~0 = maintenance), in
 * words that push toward the target rather than just reporting the number.
 */
export function balanceStatus(balance: number, goal: number, eaten: number, isToday: boolean): BalanceStatus {
  const b = Math.round(balance);
  const g = Math.round(goal);
  const label = b < -25 ? 'DEFICIT CALORICO' : b > 25 ? 'SURPLUS CALORICO' : 'IN PARI';
  const tolerance = Math.max(150, Math.abs(g) * 0.25);
  const off = b - g; // > 0: above the target (less deficit / more surplus), < 0: below it
  const closeness = Math.max(0, Math.min(1, 1 - (Math.abs(off) - tolerance) / Math.max(350, Math.abs(g))));
  const onTarget = Math.abs(off) <= tolerance;
  const goalWord = g < -50 ? 'deficit' : g > 50 ? 'surplus' : 'mantenimento';
  const goalText = goalWord === 'mantenimento' ? 'restare in pari' : `un ${goalWord} di ${kcal(g)} kcal`;

  if (eaten <= 0 && isToday) {
    return {
      closeness: 0.55,
      label,
      onTarget: false,
      icon: 'utensils',
      headline: 'Registra i pasti di oggi',
      message: `Così vediamo quanto sei vicino all'obiettivo: ${goalText}.`,
    };
  }
  if (onTarget) {
    return {
      closeness: 1,
      label,
      onTarget,
      icon: 'check',
      headline: goalWord === 'mantenimento' ? 'Perfettamente in pari!' : `Obiettivo centrato: ${signed(b)} kcal`,
      message:
        goalWord === 'mantenimento'
          ? 'Hai mangiato quanto hai bruciato: è così che si mantiene la forma. Continua così!'
          : `Il piano prevedeva ${signed(g)} kcal: sei esattamente dove devi essere. Giorno dopo giorno è così che arrivano i risultati.`,
    };
  }
  const gap = kcal(off);
  // Today's burned kcal is the whole day's estimate while meals are logged as they come:
  // under the target means there is still room to eat — a normal mid-day state, never red.
  if (isToday && off < 0) {
    return {
      closeness: Math.max(closeness, 0.4),
      label,
      onTarget,
      icon: 'utensils',
      headline: `Puoi ancora mangiare ${gap} kcal`,
      message:
        goalWord === 'surplus'
          ? 'Ti servono per il surplus di oggi: aggiungi un pasto o uno spuntino ricco di proteine.'
          : `Restando entro questa quota centri ${goalText}. Distribuiscile nei prossimi pasti.`,
    };
  }
  if (goalWord === 'deficit') {
    return off > 0
      ? {
          closeness,
          label,
          onTarget,
          icon: 'footsteps',
          headline: isToday ? `Ancora ${gap} kcal al tuo deficit` : `${gap} kcal sopra il deficit previsto`,
          message: isToday
            ? 'Una camminata o un pasto più leggero stasera e centri l’obiettivo di oggi.'
            : 'Capita: conta la media della settimana, domani si recupera.',
        }
      : {
          closeness,
          label,
          onTarget,
          icon: 'heart',
          headline: `Deficit più ampio di ${gap} kcal`,
          message: 'Bene l’impegno, ma non esagerare: mangiare abbastanza aiuta recupero, energia e muscoli.',
        };
  }
  if (goalWord === 'surplus') {
    return off < 0
      ? {
          closeness,
          label,
          onTarget,
          icon: 'utensils',
          headline: isToday ? `Mancano ${gap} kcal al tuo surplus` : `${gap} kcal sotto il surplus previsto`,
          message: isToday ? 'Aggiungi uno spuntino ricco di proteine: i muscoli crescono con l’energia giusta.' : 'Domani recupera con un pasto in più: conta la costanza.',
        }
      : {
          closeness,
          label,
          onTarget,
          icon: 'alert',
          headline: `Surplus più alto di ${gap} kcal`,
          message: 'Un surplus troppo ampio diventa grasso più che muscolo: domani resta più vicino al piano.',
        };
  }
  return {
    closeness,
    label,
    onTarget,
    icon: 'target',
    headline: off > 0 ? `${gap} kcal sopra il pareggio` : `${gap} kcal sotto il pareggio`,
    message: off > 0 ? 'Un po’ di movimento in più e torni in pari.' : 'Ti manca qualcosa: aggiungi uno spuntino per restare in pari.',
  };
}

/** Red (0) → amber → green (1), as an HSL hue. */
function statusColor(closeness: number, alpha = 1, light = 45): string {
  const hue = Math.round(closeness * 140);
  return `hsla(${hue}, 72%, ${light}%, ${alpha})`;
}

export type BalanceCardProps = {
  title: string;
  burnedKcal: number;
  eatenKcal: number;
  /** eaten − burned (negative = deficit). */
  balanceKcal: number;
  /** The plan's daily target for the balance (negative = deficit). */
  goalKcal: number;
  isToday: boolean;
  onDetails: () => void;
  onInfo: (topic: 'burned' | 'eaten') => void;
};

/** Home's main KPI: today's energy balance as a two-tone gauge (orange burned, green eaten) around a center colored by how close the day is to the plan's target. */
export function BalanceCard({ title, burnedKcal, eatenKcal, balanceKcal, goalKcal, isToday, onDetails, onInfo }: BalanceCardProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [explainOpen, setExplainOpen] = useState(false);
  const [calloutsOpen, setCalloutsOpen] = useState(false);
  useEffect(() => {
    if (!calloutsOpen) return;
    const t = setTimeout(() => setCalloutsOpen(false), 8000);
    return () => clearTimeout(t);
  }, [calloutsOpen]);
  const status = balanceStatus(balanceKcal, goalKcal, eatenKcal, isToday);
  const goalWord = goalKcal < -50 ? 'Deficit' : goalKcal > 50 ? 'Surplus' : 'Bilancio';
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <Pressable onPress={onDetails} hitSlop={8} style={styles.linkRow}>
          <ThemedText style={[styles.link, { color: theme.accent }]}>Dettagli</ThemedText>
          <Icon name="chevronRight" size={14} color={theme.accent} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => setCalloutsOpen((o) => !o)}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ zIndex: 2 }}
        accessibilityRole="button"
        accessibilityLabel="Mostra cosa significano le barre e il numero centrale">
        {width > 0 ? (
          <Gauge
            width={width}
            burnedKcal={burnedKcal}
            eatenKcal={eatenKcal}
            balanceKcal={balanceKcal}
            goalKcal={goalKcal}
            status={status}
            showCallouts={calloutsOpen}
            onMore={() => {
              setCalloutsOpen(false);
              setExplainOpen(true);
            }}
          />
        ) : (
          <View style={{ height: 200 }} />
        )}
      </Pressable>

      <View style={styles.columns}>
        <StatColumn
          title="Bruciate oggi"
          titleColor={ORANGE}
          tint={ORANGE}
          icon="flame"
          value={signed(-burnedKcal)}
          onPress={() => onInfo('burned')}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <StatColumn
          title="Obiettivo"
          titleColor={isDark ? YELLOW_TEXT.dark : YELLOW_TEXT.light}
          tint={YELLOW}
          icon="target"
          value={signed(goalKcal)}
          note={`${goalWord} giornaliero previsto dal piano`}
          onPress={() => setExplainOpen(true)}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <StatColumn
          title="Assunte oggi"
          titleColor={GREEN}
          tint={GREEN}
          icon="utensils"
          value={kcal(eatenKcal)}
          onPress={() => onInfo('eaten')}
        />
      </View>

      <Pressable onPress={onDetails} style={[styles.motivation, { backgroundColor: statusColor(status.closeness, 0.12, 50) }]}>
        <View style={[styles.motivationIcon, { backgroundColor: statusColor(status.closeness, 1, 42) }]}>
          <Icon name={status.icon} size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText style={[styles.motivationTitle, { color: statusColor(status.closeness, 1, isDark ? 62 : 34) }]}>{status.headline}</ThemedText>
          <ThemedText style={styles.motivationBody} themeColor="textSecondary">
            {status.message}
          </ThemedText>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </Pressable>

      <GlassPopup visible={explainOpen} onClose={() => setExplainOpen(false)} style={{ gap: Spacing.three }}>
        <View style={styles.popupHeader}>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            Come leggere il bilancio
          </ThemedText>
          <Pressable onPress={() => setExplainOpen(false)} hitSlop={8} accessibilityLabel="Chiudi">
            <Icon name="close" size={22} color={theme.text} />
          </Pressable>
        </View>
        <ExplainRow
          swatch={ORANGE}
          title="Barra arancione · calorie bruciate"
          body="Tutto quello che il tuo corpo consuma oggi: metabolismo a riposo, movimento quotidiano, allenamento e attività registrate. Le mostriamo in negativo perché tolgono energia."
        />
        <ExplainRow
          swatch={GREEN}
          title="Barra verde · calorie assunte"
          body="Cibo e bevande registrati oggi. Le due barre si dividono il cerchio: più una è lunga, più pesa sul bilancio della giornata."
        />
        <ExplainRow
          swatch={statusColor(status.closeness)}
          title="Il numero al centro · il tuo bilancio"
          body={`Calorie assunte meno calorie bruciate: sotto zero sei in deficit, sopra zero in surplus. Il colore va dal rosso al verde man mano che ti avvicini all'obiettivo del piano (${signed(goalKcal)} kcal).`}
        />
        <ExplainRow
          icon="target"
          iconColor={YELLOW}
          title="Obiettivo del giorno"
          body="Il bilancio che il tuo piano prevede per oggi, calcolato sul tuo obiettivo e sugli allenamenti in programma. Non serve centrarlo al grammo: conta restarci vicino giorno dopo giorno."
        />
      </GlassPopup>
    </View>
  );
}

function Gauge({
  width,
  burnedKcal,
  eatenKcal,
  balanceKcal,
  goalKcal,
  status,
  showCallouts,
  onMore,
}: {
  width: number;
  burnedKcal: number;
  eatenKcal: number;
  balanceKcal: number;
  goalKcal: number;
  status: BalanceStatus;
  showCallouts: boolean;
  onMore: () => void;
}) {
  const theme = useTheme();
  const size = Math.min(width * 0.62, 240);
  const stroke = Math.round(size * 0.085);
  const bubbleH = 46;
  const offsetY = 6;
  const height = offsetY + size * 0.93;
  const cx = width / 2;
  const cy = offsetY + size / 2;
  const r = (size - stroke) / 2;

  const total = burnedKcal + eatenKcal;
  const available = 360 - BOTTOM_GAP_DEG - MID_GAP_DEG;
  const burnedShare = total > 0 ? burnedKcal / total : 0.5;
  const burnedSweep = Math.min(Math.max(available * burnedShare, MIN_SWEEP_DEG), available - MIN_SWEEP_DEG);
  const eatenSweep = available - burnedSweep;
  const eatenStart = ARC_START_DEG + burnedSweep + MID_GAP_DEG;
  const empty = total <= 0;

  // Callout bubbles in the top corners, each tied by a short line to a dot on its arc.
  const bubbleW = Math.min(140, width * 0.38);
  const bubbleTop = 0;
  const burnedDot = polar(cx, cy, r, ARC_START_DEG + burnedSweep * 0.5);
  const eatenDot = polar(cx, cy, r, eatenStart + eatenSweep * 0.5);
  const discR = r - stroke / 2 - size * 0.06;
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="balanceDisc" cx="50%" cy="45%" r="60%">
            <Stop offset="0%" stopColor={statusColor(status.closeness, 1, 55)} stopOpacity={isDark ? 0.32 : 0.22} />
            <Stop offset="100%" stopColor={statusColor(status.closeness, 1, 50)} stopOpacity={isDark ? 0.12 : 0.07} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={discR} fill="url(#balanceDisc)" />
        <Path d={arcPath(cx, cy, r, ARC_START_DEG, burnedSweep)} stroke={empty ? theme.backgroundElement : ORANGE} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        <Path d={arcPath(cx, cy, r, eatenStart, eatenSweep)} stroke={empty ? theme.backgroundElement : GREEN} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {showCallouts ? (
          <>
        <Line x1={bubbleW * 0.55} y1={bubbleTop + bubbleH} x2={burnedDot.x} y2={burnedDot.y} stroke={ORANGE} strokeWidth={1.5} />
        <Line x1={width - bubbleW * 0.55} y1={bubbleTop + bubbleH} x2={eatenDot.x} y2={eatenDot.y} stroke={GREEN} strokeWidth={1.5} />
        <Circle cx={burnedDot.x} cy={burnedDot.y} r={stroke * 0.32} fill="#FFFFFF" stroke={ORANGE} strokeWidth={2} />
        <Circle cx={eatenDot.x} cy={eatenDot.y} r={stroke * 0.32} fill="#FFFFFF" stroke={GREEN} strokeWidth={2} />
          </>
        ) : null}
      </Svg>

      {showCallouts ? (
        <>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[styles.bubble, { left: 0, top: bubbleTop, width: bubbleW, height: bubbleH, backgroundColor: isDark ? '#3A2414' : '#FFF4EA', borderColor: 'rgba(255,122,0,0.45)' }]}>
        <ThemedText style={[styles.bubbleTitle, { color: ORANGE }]} numberOfLines={1}>
          Calorie bruciate
        </ThemedText>
        <ThemedText style={styles.bubbleBody} themeColor="textSecondary">
          Corpo e attività
        </ThemedText>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[styles.bubble, { right: 0, top: bubbleTop, width: bubbleW, height: bubbleH, backgroundColor: isDark ? '#14321F' : '#EEF9F2', borderColor: 'rgba(34,179,94,0.45)' }]}>
        <ThemedText style={[styles.bubbleTitle, { color: GREEN }]} numberOfLines={1}>
          Calorie assunte
        </ThemedText>
        <ThemedText style={styles.bubbleBody} themeColor="textSecondary">
          Cibo e bevande
        </ThemedText>
      </Animated.View>
        </>
      ) : null}

      <View style={[styles.center, { left: cx - discR, top: cy - discR, width: discR * 2, height: discR * 2 }]} pointerEvents="none">
        <View style={[styles.statusPill, { backgroundColor: statusColor(status.closeness, isDark ? 0.25 : 0.16, 45) }]}>
          <ThemedText style={[styles.statusPillText, { color: statusColor(status.closeness, 1, isDark ? 65 : 32) }]}>{status.label}</ThemedText>
        </View>
        <ThemedText style={[styles.centerValue, { fontSize: discR * 0.5, lineHeight: discR * 0.58 }]} adjustsFontSizeToFit numberOfLines={1}>
          {signed(balanceKcal)}
        </ThemedText>
        <ThemedText style={styles.centerUnit}>kcal</ThemedText>
      </View>

      {showCallouts ? (
        <Animated.View
          entering={FadeIn.duration(180).delay(80)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.centerCallout,
            {
              left: (width - Math.min(width * 0.8, 270)) / 2,
              width: Math.min(width * 0.8, 270),
              top: cy + discR * 0.62,
              backgroundColor: theme.backgroundElevated,
              borderColor: statusColor(status.closeness, 0.6, 50),
            },
          ]}>
          <ThemedText style={[styles.bubbleTitle, { color: statusColor(status.closeness, 1, isDark ? 62 : 34) }]}>Il numero al centro</ThemedText>
          <ThemedText style={styles.calloutBody} themeColor="textSecondary">
            Calorie assunte meno bruciate. L’obiettivo del piano per oggi è {signed(goalKcal)} kcal: più ti avvicini, più il centro passa dal rosso al verde.
          </ThemedText>
          <Pressable onPress={onMore} hitSlop={8}>
            <ThemedText style={[styles.calloutLink, { color: theme.accent }]}>Come leggere il bilancio ›</ThemedText>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

function StatColumn({
  title,
  titleColor,
  tint,
  icon,
  value,
  note,
  onPress,
}: {
  title: string;
  titleColor: string;
  tint: string;
  icon: IconName;
  value: string;
  note?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.column} onPress={onPress}>
      <View style={styles.columnTitleRow}>
        <ThemedText style={[styles.columnTitle, { color: titleColor }]} numberOfLines={1}>
          {title}
        </ThemedText>
        <Icon name="info" size={12} color={titleColor} />
      </View>
      <View style={[styles.iconCircle, { backgroundColor: tint + '1F' }]}>
        <Icon name={icon} size={22} color={tint} />
      </View>
      <View style={styles.valueRow}>
        <ThemedText style={styles.columnValue}>{value}</ThemedText>
        <ThemedText style={styles.columnUnit} themeColor="textSecondary">
          kcal
        </ThemedText>
      </View>
      {note ? (
        <ThemedText style={styles.columnNote} themeColor="textTertiary" numberOfLines={2}>
          {note}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function ExplainRow({ swatch, icon, iconColor, title, body }: { swatch?: string; icon?: IconName; iconColor?: string; title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={styles.explainRow}>
      {icon ? (
        <Icon name={icon} size={20} color={iconColor ?? theme.textSecondary} />
      ) : (
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  bubble: { position: 'absolute', borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, justifyContent: 'center', gap: 1 },
  bubbleTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: -0.2 },
  bubbleBody: { fontSize: 10.5, lineHeight: 13, fontWeight: '500' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 2 },
  statusPillText: { fontSize: 9.5, lineHeight: 12, fontWeight: '800', letterSpacing: 0.6 },
  centerValue: { fontWeight: '900', letterSpacing: -1.5 },
  centerUnit: { fontSize: 14, lineHeight: 17, fontWeight: '700' },
  columns: { flexDirection: 'row', alignItems: 'stretch', marginTop: Spacing.two, paddingVertical: Spacing.two },
  column: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  columnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  columnTitle: { fontSize: 12, lineHeight: 15, fontWeight: '700' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  columnNote: { fontSize: 10, lineHeight: 13, fontWeight: '500', textAlign: 'center', marginTop: -2 },
  centerCallout: { position: 'absolute', borderWidth: 1, borderRadius: 14, padding: 10, gap: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  calloutBody: { fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
  calloutLink: { fontSize: 12, lineHeight: 15, fontWeight: '700' },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  columnValue: { fontSize: 19, lineHeight: 23, fontWeight: '800', letterSpacing: -0.4 },
  columnUnit: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  motivation: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 18 },
  motivationIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  motivationTitle: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  motivationBody: { fontSize: 12.5, lineHeight: 17, fontWeight: '500' },
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  explainRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  swatch: { width: 20, height: 8, borderRadius: 4, marginTop: 6 },
});
