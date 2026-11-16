import { evaluation } from './evaluation';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { c, fonts } from './theme';
import { RequestGate, validateBaseUrl } from './domain';
import { manualPlace, parseArea, parseCatalogue, parseHealth, parsePoint, parseResolved, placeRequest,
  type AreaResult, type Place, type PointResult } from './places';

type Result = { kind: 'point'; value: PointResult } | { kind: 'area'; value: AreaResult };
type Props = { base: string; onBaseChange: (base: string) => void };
const initialNames = ['Nelson', 'Tāhunanui', 'Rocks Road', 'Stoke', 'Monaco', 'Atawhai'];
function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPress={onPress} style={({ pressed }) => [s.action, secondary && s.secondary,
      disabled && { opacity: 0.5 }, pressed && { transform: [{ translateY: 2 }] }, focused && s.focus]}>
    <Text style={[s.actionText, secondary && { color: c.teal }]}>{title}</Text>
  </Pressable>;
}
function Panel({ title, children, warning = false }: { title: string; children: React.ReactNode; warning?: boolean }) {
  return <View style={[s.panel, warning && { backgroundColor: c.sand }]}>
    <Text style={s.title}>{title}</Text>{children}
  </View>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <View style={s.metric}><Text style={s.number}>{value}</Text><Text style={s.small}>{label}</Text></View>;
}
const measurement = (v: number | null, unit: string) => v == null ? 'Unavailable' : `${v.toFixed(1)} ${unit}`;

export default function PlaceWorkspace({ base, onBaseChange }: Props) {
  const [address, setAddress] = useState(base);
  const [settings, setSettings] = useState(true);
  const [connection, setConnection] = useState<ReturnType<typeof parseHealth> | null>(null);
  const [catalogue, setCatalogue] = useState<Place[]>([]);
  const [query, setQuery] = useState('Tāhunanui');
  const [selected, setSelected] = useState<Place | null>(null);
  const [manual, setManual] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState<500 | 1000 | 2000>(1000);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [update, setUpdate] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [mapError, setMapError] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const gate = useRef(new RequestGate());
  const request = useRef<AbortController | null>(null);
  const busy = Boolean(pending);

  function cancel() {
    gate.current.invalidate(); request.current?.abort(); request.current = null;
    setPending(''); setUpdate('Waiting cancelled. Server work may still finish; you can try again.');
  }
  useEffect(() => {
    const currentGate = gate.current;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && request.current) cancel();
    });
    return () => { currentGate.invalidate(); request.current?.abort(); sub.remove(); };
  }, []);

  async function run(label: string, task: (signal: AbortSignal) => Promise<() => void>) {
    request.current?.abort();
    const id = gate.current.next(), ctrl = new AbortController(), started = Date.now();
    request.current = ctrl; let timedOut = false;
    setPending(label); setError(''); setUpdate(''); setSeconds(0); setResult(null); setMapError(false); setMapOpen(false);
    const ticker = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 60000);
    try {
      const apply = await task(ctrl.signal);
      if (gate.current.accepts(id)) apply();
    } catch (e) {
      if (gate.current.accepts(id)) {
        const message = e instanceof Error ? e.message : 'The request could not complete.';
        setError(timedOut ? 'No result arrived within 60 seconds. Check the laptop service and try again.' :
          /fetch|network/i.test(message) ? 'The places service could not be reached. Check its address and laptop terminal.' : message);
      }
    } finally {
      clearTimeout(timer); clearInterval(ticker);
      if (gate.current.accepts(id)) { setPending(''); request.current = null; }
    }
  }

  function connect() {
    setConnection(null); setSelected(null);
    void run('Checking the places service', async signal => {
      const validated = validateBaseUrl(address);
      const health = parseHealth(await placeRequest(validated, '/api/health', signal));
      const places = parseCatalogue(await placeRequest(validated, '/api/places', signal));
      return () => { onBaseChange(validated); setConnection(health); setCatalogue(places); setSettings(false);
        setSelected(null); setUpdate(health.areaReady ? 'Connected. Choose a place to begin.' :
          `Connected, but ${health.missing} area runtime files are missing. Place lookup works; area analysis needs those files.`); };
    });
  }
  function resolve(name = query) {
    void run('Finding your place', async signal => {
      const place = parseResolved(await placeRequest(base, '/api/places/resolve', signal, { query: name.trim() }));
      return () => { setQuery(name); setSelected(place); setUpdate('Check the place and coordinates before analysing.'); };
    });
  }
  function useManual() {
    try { const place = manualPlace(query, latitude, longitude); setSelected(place); setResult(null); setError(''); setUpdate('Manual coordinates selected. Coverage will be checked during analysis.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Check both coordinates.'); }
  }
  function analyse(kind: 'point' | 'area') {
    if (!selected) return;
    const place = selected;
    void run(kind === 'point' ? 'Screening this land location' : 'Analysing the surrounding land', async signal => {
      const body = { name: place.display_name, latitude: place.latitude, longitude: place.longitude };
      const response = await placeRequest(base, kind === 'point' ? '/api/places/point' : '/api/places/analyse', signal,
        kind === 'point' ? body : { ...body, radius_metres: radius });
      const parsed: Result = kind === 'point' ? { kind, value: parsePoint(response) } : { kind, value: parseArea(response) };
      return () => { setResult(parsed); setUpdate('Result received. Scroll down to review the evidence.'); };
    });
  }

  return <>
    <Text style={s.eyebrow}>EXPLORE · YOUR EXISTING V3 SERVICE</Text>
    <Text style={s.display}>A place to start.</Text>
    <Text style={s.body}>Find a Nelson location and check the land around it.</Text>
    <Action title={settings ? 'Hide connection settings' : 'Connection settings'} secondary disabled={busy} onPress={() => setSettings(!settings)} />
    {settings && <Panel title="Connect your laptop">
      <Text style={s.body}>Use the mobile places service on port 8081. Your photo demo uses port 8080 separately.</Text>
      <TextInput accessibilityLabel="Places backend address" value={address} onChangeText={setAddress} editable={!busy}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} />
      <Action title="Connect places service" disabled={busy} onPress={connect} />
      <Text style={s.small}>Search text and selected coordinates go to this service. Online address search, when enabled, also sends the search text to OpenStreetMap Nominatim.</Text>
    </Panel>}
    {error !== '' && <View accessibilityLiveRegion="assertive"><Panel title="No result available" warning><Text style={s.body}>{error}</Text></Panel></View>}
    {update !== '' && <Text style={s.body} accessibilityLiveRegion="polite">{update}</Text>}
    {busy && <Panel title={pending}><ActivityIndicator color={c.blue} /><Text style={s.body}>Waiting for the service · {seconds}s of 60s maximum</Text><Action title="Cancel waiting" secondary onPress={cancel} /></Panel>}
    {!selected && <Panel title="Find a place">
      <TextInput accessibilityLabel="Place or address" value={query} onChangeText={setQuery} editable={!busy}
        placeholder="For example, Tāhunanui" placeholderTextColor={c.muted} maxLength={200} style={s.input}
        returnKeyType="search" onSubmitEditing={() => { if (connection && !busy && query.trim()) resolve(); }} />
      <Action title="Search place" disabled={!connection || busy || !query.trim()} onPress={() => resolve()} />
      <Text style={s.small}>{connection?.online ? 'Search runs when you press Search. Confirm the returned match.' : 'Listed places work without online address search. Manual coordinates are also available.'}</Text>
      <View style={s.chips}>{(catalogue.length ? catalogue.map(p => p.display_name) : initialNames).map(name =>
        <Pressable key={name} accessibilityRole="button" accessibilityLabel={`Find ${name}`} accessibilityState={{ disabled: !connection || busy }}
          disabled={!connection || busy} style={[s.chip, (!connection || busy) && { opacity: 0.5 }]}
          onPress={() => resolve(name)}><Text style={s.chipText}>{name}</Text></Pressable>)}</View>
      <Action title={manual ? 'Hide manual coordinates' : 'Enter coordinates instead'} secondary disabled={busy} onPress={() => setManual(!manual)} />
      {manual && <>
        <Text style={s.body}>WGS84 coordinates in decimal degrees. A place name alone does not establish model coverage.</Text>
        <TextInput accessibilityLabel="Latitude" placeholder="Latitude, e.g. -41.2844" placeholderTextColor={c.muted}
          value={latitude} onChangeText={setLatitude} editable={!busy} autoCapitalize="none" style={s.input} />
        <TextInput accessibilityLabel="Longitude" placeholder="Longitude, e.g. 173.2450" placeholderTextColor={c.muted}
          value={longitude} onChangeText={setLongitude} editable={!busy} autoCapitalize="none" style={s.input} />
        <Action title="Use these coordinates" secondary disabled={!connection || busy} onPress={useManual} />
      </>}
    </Panel>}
    {selected && <>
      <Panel title={selected.display_name}>
        <Text style={s.body}>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</Text>
        <Text style={s.small}>Source: {selected.source.replaceAll('_', ' ')}</Text>
        <Action title="Choose another place" secondary disabled={busy} onPress={() => { setSelected(null); setResult(null); setError(''); setUpdate(''); }} />
      </Panel>
      <Action title="Screen this point" disabled={busy} onPress={() => analyse('point')} />
      <Panel title="Or check a wider area">
        <View style={s.chips}>{([500, 1000, 2000] as const).map(r => <Pressable key={r} accessibilityRole="radio"
          accessibilityLabel={`${r} metre radius`} accessibilityState={{ checked: radius === r, disabled: busy }} disabled={busy}
          onPress={() => { setRadius(r); setResult(null); setError(''); }} style={[s.chip, radius === r && { backgroundColor: c.blue }]}>
          <Text style={[s.chipText, radius === r && { color: c.white }]}>{r === 500 ? '500 m' : `${r / 1000} km`}</Text>
        </Pressable>)}</View>
        <Action title={`Analyse ${radius === 500 ? '500 m' : `${radius / 1000} km`} area`} disabled={busy || !connection?.areaReady} onPress={() => analyse('area')} />
        {!connection?.areaReady && <Text style={s.body}>Area analysis needs the V3 runtime files. Add them to your existing web project, then reconnect.</Text>}
      </Panel>
    </>}
    {result?.kind === 'point' && <>
      <Text style={s.eyebrow}>LIVE POINT SCREENING · HUMAN REVIEW REQUIRED</Text>
      <Panel title={result.value.flagged ? 'Further investigation recommended' : 'Below the screening threshold'} warning={result.value.flagged}>
        <Text style={s.body}>{result.value.flagged ? 'This land location meets the frozen V3 screening threshold. Review it with qualified GIS and engineering personnel.' : 'This land location is below the frozen V3 threshold. This does not establish that it is safe from flooding.'}</Text>
        <View style={s.metrics}><Metric label="Susceptibility score" value={result.value.score.toFixed(6)} /><Metric label="Frozen threshold" value={result.value.threshold.toFixed(4)} /></View>
        <Text style={s.body}>This is an uncalibrated screening score, not a percentage chance of flooding.</Text>
      </Panel>
      <Panel title="Evidence behind the result">
        <Text style={s.body}>Elevation: {measurement(result.value.elevation, 'm')}{'\n'}Slope: {measurement(result.value.slope, '°')}{'\n'}Coast distance: {measurement(result.value.coastDistance, 'm')}</Text>
        <Text style={s.small}>{result.value.model} · precomputed regional raster lookup</Text>
        {result.value.reasons.map(reason => <Text key={reason} style={s.body}>• {reason}</Text>)}
        {result.value.limitations.map(limitation => <Text key={limitation} style={s.small}>{limitation}</Text>)}
      </Panel>
    </>}
    {result?.kind === 'area' && <>
      <Text style={s.eyebrow}>LIVE AREA SCREENING · HUMAN REVIEW REQUIRED</Text>
      <Panel title="Your area, in context" warning={result.value.flaggedKm2 > 0}>
        <Text style={s.body}>{result.value.summary}</Text>
        <View style={s.metrics}><Metric label="Land evaluated" value={`${result.value.evaluatedKm2.toFixed(3)} km²`} /><Metric label="Flagged land" value={`${result.value.flaggedKm2.toFixed(3)} km²`} /></View>
        <View style={s.metrics}><Metric label="Evaluated land flagged" value={`${result.value.flaggedPercent.toFixed(2)}%`} /><Metric label="Land coverage" value={`${result.value.coveragePercent.toFixed(1)}%`} /></View>
        <Text style={s.body}>Mean score: {result.value.meanScore.toFixed(6)} · frozen threshold: {result.value.threshold.toFixed(4)}</Text>
        {result.value.flaggedKm2 === 0 && <Text style={s.body}>No cells were flagged. This does not prove that flood risk is absent.</Text>}
      </Panel>
      {result.value.mapPath && <Panel title="Local screening evidence">
        {mapError ? <Text style={s.body}>The evidence map could not load. The numerical result is still available above; run the analysis again to regenerate its map.</Text> :
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Enlarge the screening evidence image" accessibilityHint="Opens the image full screen" onPress={() => { evaluation.log('map_opened'); setMapOpen(true); }}>
              <Image source={{ uri: `${base}${result.value.mapPath}` }} style={s.map} contentFit="contain" cachePolicy="none"
                accessible={false} onError={() => setMapError(true)} />
              <Text style={s.enlargeHint}>Tap to enlarge ↗</Text>
            </Pressable>
            <Modal visible={mapOpen} transparent animationType="fade" onRequestClose={() => setMapOpen(false)}>
              <View style={s.viewerOverlay}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close enlarged image" onPress={() => setMapOpen(false)} style={s.viewerClose}>
                  <Text style={s.viewerCloseText}>Close</Text>
                </Pressable>
                <Image source={{ uri: `${base}${result.value.mapPath}` }} style={s.viewerImage} contentFit="contain" cachePolicy="none" />
              </View>
            </Modal>
          </>}
      </Panel>}
      <Panel title="What to do next"><Text style={s.body}>Review the mapped area with qualified GIS and engineering personnel before any planning decision.</Text><Text style={s.body}>{result.value.warning}</Text></Panel>
    </>}
    <Text style={s.small}>This screen uses location evidence. It does not analyse your photographs or run the planning language model.</Text>
    <Text style={s.small}>Online place names, when enabled: © OpenStreetMap contributors · ODbL. Coverage is limited to prepared Nelson land data.</Text>
  </>;
}

const s = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: c.ink },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18, color: c.blue },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: c.muted },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, color: c.muted },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: c.ink },
  panel: { padding: 18, borderRadius: 22, backgroundColor: c.white, gap: 12 },
  input: { minHeight: 56, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#B5C3DF', backgroundColor: c.bg,
    color: c.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  action: { minHeight: 56, padding: 16, borderRadius: 28, backgroundColor: c.blue, borderBottomWidth: 4,
    borderBottomColor: '#1737AD', alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: c.mint, borderBottomColor: '#A6DDCC' },
  actionText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: c.white, textAlign: 'center' },
  focus: { outlineColor: c.navy, outlineWidth: 3, outlineOffset: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: c.blueTint, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: c.blue },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: 130, gap: 4, paddingVertical: 8 },
  number: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: c.blue },
  enlargeHint: { fontFamily: fonts.semi, fontSize: 13, lineHeight: 20, color: c.blue, textAlign: 'center', paddingVertical: 10 },
  map: { width: '100%', aspectRatio: 14 / 11, borderRadius: 12 },
  viewerOverlay: { flex: 1, backgroundColor: '#101820', justifyContent: 'center', padding: 16 },
  viewerClose: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 },
  viewerCloseText: { fontFamily: fonts.bold, fontSize: 15, color: c.white },
  viewerImage: { flex: 1, width: '100%' },
});

