import type { ConversationWithMembers, MessageWithSender } from '@comot/shared';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import {
  fetchConversation,
  fetchMessageById,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
} from '@/lib/chat';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme';

export default function ThreadScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, membership } = useAuth();

  const [conversation, setConversation] = useState<ConversationWithMembers | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MessageWithSender>>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const [conv, msgs] = await Promise.all([fetchConversation(id), fetchMessages(id)]);
      setConversation(conv);
      setMessages(msgs);
    } catch {
      // surfaced via empty state
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = subscribeToMessages(id, async (messageId) => {
      const msg = await fetchMessageById(messageId);
      if (msg) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const title =
    conversation?.kind === 'channel'
      ? `#${conversation.name === 'general' ? t('chat.general') : conversation.name}`
      : conversation?.members.find((m) => m.user_id !== session?.user.id)?.profile?.full_name || '';

  const submit = async () => {
    const body = draft.trim();
    if (!body || !conversation || !membership?.building) return;
    setSending(true);
    setDraft('');
    try {
      await sendMessage({ conversationId: id, buildingId: conversation.building_id, body });
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
      setDraft(body); // restore draft on failure
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: MessageWithSender }) => {
    const mine = item.sender_id === session?.user.id;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {!mine ? <Text style={styles.sender}>{item.sender?.full_name || '—'}</Text> : null}
          <Text style={[styles.body, mine ? styles.bodyMine : null]}>{item.body}</Text>
          <Text style={[styles.time, mine ? styles.timeMine : null]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title }} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('chat.noMessages')}</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.typeMessage')}
          placeholderTextColor={colors.inkFaint}
          multiline
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={submit}
          disabled={sending || !draft.trim()}
          style={[styles.sendBtn, (sending || !draft.trim()) && { opacity: 0.5 }]}
        >
          <Text style={styles.sendText}>{t('chat.send')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSoft },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.inkFaint, marginTop: spacing.xl },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMine: { backgroundColor: colors.primary },
  sender: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2, textAlign: 'left' },
  body: { fontSize: 15, color: colors.ink, textAlign: 'left' },
  bodyMine: { color: colors.white },
  time: { fontSize: 10, color: colors.inkFaint, marginTop: 3, textAlign: 'right' },
  timeMine: { color: colors.periwinkle },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    maxHeight: 120,
    textAlign: 'left',
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sendText: { color: colors.white, fontWeight: '700' },
});
