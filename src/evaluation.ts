// Evaluation events are allowlisted. Never pass photo URIs, notes, coordinates or responses.
export type Task = 'T1' | 'T2' | 'T3' | 'T4';
export type Outcome = 'independent' | 'assisted' | 'incomplete' | 'service_blocked';
export type EventName = 'session_start' | 'session_end' | 'task_start' | 'task_end' |
  'capture_opened' | 'photo_selected' | 'photo_ready' | 'preparation_failed' |
  'analysis_requested' | 'result_received' | 'result_shown' | 'request_failed' |
  'waiting_cancelled' | 'photo_discarded' | 'review_opened' | 'map_opened';
type Detail = 'none' | 'camera' | 'gallery' | 'done' | 'needs_review' |
  'mock_done' | 'mock_needs_review' | 'independent' | 'assisted' | 'incomplete' | 'service_blocked';
type Row = { participant: string; task: Task | ''; event: EventName; elapsed_ms: number; detail: Detail };
const tasks = new Set(['T1', 'T2', 'T3', 'T4']);
const details = new Set<Detail>(['none', 'camera', 'gallery', 'done', 'needs_review',
  'mock_done', 'mock_needs_review', 'independent', 'assisted', 'incomplete', 'service_blocked']);
const names = new Set<EventName>(['session_start','session_end','task_start','task_end',
  'capture_opened','photo_selected','photo_ready','preparation_failed','analysis_requested',
  'result_received','result_shown','request_failed','waiting_cancelled','photo_discarded',
  'review_opened','map_opened']);
export function createEvaluation(clock = () => performance.now()) {
  let rows: Row[] = [];
  let started = 0;
  let state = { participant: '', task: '' as Task | '', active: false, count: 0 };
  const listeners = new Set<() => void>();
  function publish() { state = { ...state, count: rows.length }; listeners.forEach(fn => fn()); }
  function append(event: EventName, detail: Detail = 'none') {
    if (rows.length >= 5000) throw Error('Evaluation log is full. Export and clear it before continuing.');
    rows.push({ participant: state.participant, task: state.task, event,
      elapsed_ms: Math.max(0, Math.round(clock() - started)), detail });
  }
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    snapshot: () => state,
    start(participant: string, consent: boolean) {
      if (!consent) throw Error('Record voluntary consent before starting.');
      if (!/^P[0-9]{2,3}$/.test(participant)) throw Error('Use a code such as P01, with no name.');
      if (state.active) throw Error('End the current session first.');
      if (rows.length) throw Error('Export and clear the previous session before starting another.');
      started = clock(); state = { participant, task: '', active: true, count: 0 };
      append('session_start'); publish();
    },
    startTask(task: Task) {
      if (!state.active || state.task) throw Error('Start a session and finish any active task first.');
      if (!tasks.has(task)) throw Error('Unknown task.');
      state = { ...state, task }; append('task_start'); publish();
    },
    finish(outcome: Outcome) {
      if (!state.active || !state.task) throw Error('There is no active task.');
      if (!['independent','assisted','incomplete','service_blocked'].includes(outcome)) throw Error('Unknown outcome.');
      append('task_end', outcome); state = { ...state, task: '' }; publish();
    },
    log(event: EventName, detail: Detail = 'none') {
      // Instrumentation must never interrupt the app or collect outside an active task.
      if (!state.active || !state.task || rows.length >= 4998) return;
      if (!names.has(event) || !details.has(detail) ||
          ['session_start','session_end','task_start','task_end'].includes(event)) return;
      append(event, detail); publish();
    },
    end() {
      if (!state.active) return;
      if (state.task) throw Error('Record the active task outcome first.');
      append('session_end'); state = { ...state, active: false }; publish();
    },
    clear() {
      if (state.active) throw Error('End the session before clearing.');
      rows = []; state = { participant: '', task: '', active: false, count: 0 }; publish();
    },
    csv() {
      return ['participant,task,event,elapsed_ms,detail',
        ...rows.map(r => [r.participant,r.task,r.event,r.elapsed_ms,r.detail].join(','))].join('\r\n');
    },
  };
}
export const evaluation = createEvaluation();
