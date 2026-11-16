import React, { useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { evaluation, type Outcome, type Task } from './evaluation';
import { c, fonts } from './theme';

function Action({ text, onPress }: { text: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.button}><Text style={s.action}>{text}</Text></Pressable>;
}
export default function EvaluationPanel({ visible, onClose, onStartTask, onFinishTask }: {
  visible: boolean; onClose: () => void; onStartTask: () => void; onFinishTask: () => void;
}) {
  const state = useSyncExternalStore(evaluation.subscribe, evaluation.snapshot);
  const [code, setCode] = useState('P01');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  function attempt(fn: () => void) {
    try { fn(); setMessage(''); } catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); }
  }
  function start(task: Task) {
    attempt(() => { evaluation.startTask(task); onStartTask(); });
  }
  async function exportLog() {
    try {
      const csv = evaluation.csv();
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'climateadapt-evaluation.csv'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        await Share.share({ title: 'ClimateAdapt evaluation CSV', message: csv });
      }
      setMessage('Export opened. Confirm you saved the CSV text before clearing this session.');
    } catch { setMessage('Export could not open. The log remains available here.'); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Evaluation controls</Text>
        <Text style={s.body}>Facilitator only. Events stay in memory until cleared or the app restarts. Export before closing the app. No photos, GPS, notes or response text are logged.</Text>
        <Action text="Return to app" onPress={onClose} />
        {!state.active && state.count === 0 && <>
          <Text style={s.body}>Participant code</Text>
          <TextInput accessibilityLabel="Anonymous participant code" value={code}
            onChangeText={setCode} autoCapitalize="characters" maxLength={4} style={s.input} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }}
            onPress={() => setConsent(value => !value)} style={s.button}>
            <Text style={s.action}>{consent ? '☑' : '☐'} Voluntary consent obtained</Text>
          </Pressable>
          <Text style={s.body}>Explain the tasks and logging. Participation is optional and they may stop. Use supplied photos without identifying details and leave GPS off.</Text>
          <Action text="Start session" onPress={() => attempt(() => evaluation.start(code.trim().toUpperCase(), consent))} />
        </>}
        <Text style={s.body}>{state.participant || 'No participant'} · {state.task || 'No active task'} · {state.count} events</Text>
        {state.active && !state.task && <>
          <Text style={s.body}>Read the prompt first. Start its timer, then hand over the phone. Task outcomes are recorded by the facilitator.</Text>
          {(['T1','T2','T3','T4'] as Task[]).map(task =>
            <Action key={task} text={'Start ' + task} onPress={() => start(task)} />)}
          <Action text="End session" onPress={() => attempt(() => evaluation.end())} />
        </>}
        {state.active && !!state.task && <>
          <Text style={s.body}>Stop timing when the participant reaches the endpoint or stops. Opening these controls adds a small facilitator delay. Use observation notes to record it.</Text>
          {(['independent','assisted','incomplete','service_blocked'] as Outcome[]).map(outcome =>
            <Action key={outcome} text={'Finish task · ' + outcome.replace('_',' ')}
              onPress={() => attempt(() => { onFinishTask(); evaluation.finish(outcome); })} />)}
        </>}
        {state.count > 0 && <Action text="Export CSV" onPress={() => { void exportLog(); }} />}
        {!state.active && state.count > 0 && <Action text="Clear exported session" onPress={() => attempt(() => {
          evaluation.clear(); setConsent(false);
        })} />}
        {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: 24, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 24, color: c.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: c.ink },
  button: { minHeight: 48, padding: 14, borderRadius: 16, backgroundColor: c.mint },
  action: { fontFamily: fonts.bold, fontSize: 15, color: c.teal },
  input: { minHeight: 48, padding: 12, backgroundColor: c.white, borderWidth: 1, borderColor: c.muted, borderRadius: 12, color: c.ink },
});
