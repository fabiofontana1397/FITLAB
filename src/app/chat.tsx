import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SUGGESTED_PROMPTS } from '@/lib/assistant/mock-assistant';
import { goBackOr } from '@/lib/navigation/go-back';
import { useChatStore, type ChatMessage } from '@/store/chat-store';

// The chat FAB sits bottom-right, docked beside the tab bar (see
// app-tabs.tsx) — this screen grows out of / shrinks back into that same
// corner, like the classic macOS Dock "genie" minimize effect, instead of
// just sliding up as a flat sheet.
const GENIE_ORIGIN_OFFSET = { right: 40, bottom: 46 };

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { messages, isTyping, error, loadHistory, send } = useChatStore();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const progress = useSharedValue(0);
  const originX = width - GENIE_ORIGIN_OFFSET.right;
  const originY = height - (insets.bottom + BottomTabInset + GENIE_ORIGIN_OFFSET.bottom);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 15, stiffness: 110, mass: 0.9 });
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    // Shared values are stable refs meant to be reassigned via `.value` from
    // anywhere (here and in the entrance effect above) — that's the normal
    // reanimated idiom, not the kind of dependency mutation this lint rule
    // is guarding against.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(goBackOr)('/');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => {
    // A genie doesn't grow uniformly: it stays thin longest along the axis
    // it's being pulled through (vertical, toward the corner) while the
    // other axis catches up faster — scaleY lags scaleX through the curve.
    const scaleX = interpolate(progress.value, [0, 1], [0.08, 1]);
    const scaleY = interpolate(progress.value, [0, 0.6, 1], [0.03, 0.5, 1]);
    const translateX = (1 - scaleX) * (originX - width / 2);
    const translateY = (1 - scaleY) * (originY - height / 2);
    return {
      opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 1]),
      borderRadius: interpolate(progress.value, [0, 1], [30, 0]),
      transform: [{ translateX }, { translateY }, { scaleX }, { scaleY }],
    };
  });

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    send(text);
    setDraft('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <View style={styles.overlay}>
      <Animated.View pointerEvents="box-none" style={[styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.background }]}
          behavior={Platform.select({ ios: 'padding', default: undefined })}>
          <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">Coach FITLAB</ThemedText>
              <ThemedText type="caption" themeColor={error ? undefined : 'textSecondary'} style={error ? { color: theme.danger } : undefined}>
                {error ?? (isTyping ? 'Sta scrivendo…' : 'Nutrizionista & personal trainer AI')}
              </ThemedText>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
                <View style={styles.closeInner}>
                  <Icon name="close" size={18} color={theme.text} />
                </View>
              </GlassSurface>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => <Bubble message={item} />}
          />

          {messages.length <= 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsRow}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Pressable key={prompt} onPress={() => handleSend(prompt)} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="caption">{prompt}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.two, borderTopColor: theme.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Scrivi al tuo coach…"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              onSubmitEditing={() => handleSend(draft)}
              returnKeyType="send"
            />
            <Pressable onPress={() => handleSend(draft)} style={[styles.sendButton, { backgroundColor: theme.accent }]}>
              <Icon name="send" size={18} color={theme.onAccent} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: isUser ? theme.accent : theme.backgroundElement, borderBottomRightRadius: isUser ? 4 : Radius.medium, borderBottomLeftRadius: isUser ? Radius.medium : 4 },
        ]}>
        <ThemedText type="small" style={{ color: isUser ? theme.onAccent : theme.text }}>
          {message.text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    flex: 1,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  closeButton: {
    width: 36,
    height: 36,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipsRow: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
