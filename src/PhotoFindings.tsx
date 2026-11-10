import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type AnalysisResult } from './domain';
import { c, fonts } from './theme';

function Panel({ title, children, warning = false }: { title: string; children: React.ReactNode; warning?: boolean }) {
  return <View style={[s.card, warning && { backgroundColor: c.sand }]}><Text style={s.title}>{title}</Text>{children}</View>;
}
function Lines({ values }: { values: string[] }) {
  return <>{values.map((v, i) => <Text key={`${i}-${v}`} style={s.body}>• {v}</Text>)}</>;
}
export default function PhotoFindings({ result }: { result: AnalysisResult }) {
  if (result.demo) return <>
    <Text style={s.eyebrow}>MOCK RESPONSE · NOT REAL PHOTO ANALYSIS</Text>
    <Panel title={result.status === 'needs_review' ? 'Needs review — a clearer view would help' : 'Result received — ready for human review'} warning={result.status === 'needs_review'}>
      <Text style={s.body}>This is a fixed demonstration response. It does not establish that water is present in your photo.</Text>
      <Text style={s.title}>{result.label}</Text><Text style={s.metric}>{Math.round(result.confidence * 100)}%</Text>
      <Text style={s.small}>Demonstration confidence value</Text>
    </Panel>
    {result.alternatives.map(a => <Panel key={a.label} title="Alternative finding" warning><Text style={s.body}>{a.label}: {Math.round(a.confidence * 100)}% (mock)</Text></Panel>)}
    <Panel title="Location screening"><Text style={s.body}>Not calculated by the photo demo. Use Explore for live V3 location evidence.</Text></Panel>
  </>;
  const location = result.locationScreening;
  return <>
    <Text style={s.eyebrow}>LOCAL PHOTO ANALYSIS · HUMAN REVIEW REQUIRED</Text>
    <View accessibilityLiveRegion="polite"><Panel title={result.label} warning={result.status === 'needs_review'}>
      {result.status === 'needs_review' && <Text style={s.body}>Needs review: image clarity or scene interpretation is limited.</Text>}
      <Text style={s.body}>{result.summary}</Text>
      <Text style={s.small}>Gemma 3 4B · model observations, not a verified field report</Text>
    </Panel></View>
    <Panel title="What appears visible"><Lines values={result.observations} /></Panel>
    <Panel title="What is uncertain" warning><Lines values={result.uncertainties} /></Panel>
    <Panel title="Suggested follow-up"><Lines values={result.nextSteps} /></Panel>
    <Panel title="Location susceptibility — separate evidence" warning={location.status === 'ready' && location.flagged}>
      {location.status === 'ready' ? <>
        <Text style={s.body}>{location.flagged ? 'The attached coordinate meets the V3 threshold for further investigation.' : 'The attached coordinate is below the V3 threshold. This does not establish that the location is safe from flooding.'}</Text>
        <Text style={s.metric}>{location.score.toFixed(6)}</Text><Text style={s.small}>Uncalibrated susceptibility score · threshold {location.threshold.toFixed(4)}</Text>
        <Text style={s.body}>This is not a percentage chance of flooding. It is independent of the photograph.</Text>
        <Text style={s.small}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · {location.model}</Text>
      </> : <Text style={s.body}>{location.message}</Text>}
    </Panel>
    <Panel title="Before using this result"><Lines values={result.limitations} /><Text style={s.small}>No calibrated image-confidence percentage is available.</Text></Panel>
  </>;
}
const s = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, backgroundColor: c.white, gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: c.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: c.muted },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, color: c.muted },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18, color: c.blue },
  metric: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: c.blue },
});
