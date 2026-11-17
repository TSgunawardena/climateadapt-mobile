import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { applyPrivacy } from './privacy-api';
import { drawnRegion, type MaskedPhoto, type MaskRegion, type PrivacyScan } from './privacy';
import { c, fonts } from './theme';

function Action({ text, onPress, disabled = false, primary = false }: { text: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[s.action, primary && s.primary, disabled && { opacity: .45 }]}><Text style={[s.actionText,primary && s.primaryText]}>{text}</Text></Pressable>;
}
export default function PrivacyMaskEditor({ uri, scan, base, onApply, onClose }: {
  uri: string; scan: PrivacyScan; base: string;
  onApply: (photo: MaskedPhoto) => void; onClose: () => void;
}) {
  const [regions, setRegions] = useState<MaskRegion[]>(scan.regions);
  const [draft, setDraft] = useState<MaskRegion | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const start = useRef<{ x: number; y: number } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const window = useWindowDimensions();
  const scale = Math.min(Math.max(1, Math.min(600, window.width - 40)) / scan.width, Math.max(150, window.height * .52) / scan.height);
  const width = scan.width * scale, height = scan.height * scale;
  const point = (x: number, y: number) => ({ x: Math.max(0, Math.min(1, x / width)), y: Math.max(0, Math.min(1, y / height)) });
  function edit(next: MaskRegion[]) { setRegions(next); setChecked(false); setError(''); }
  async function apply() {
    if (!checked || busy || !ready) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setBusy(true); setError('');
    try {
      const photo = await applyPrivacy(base, uri, scan.source_sha256, regions, controller.signal, scan);
      onApply(photo);
    } catch (failure) {
      setError(controller.signal.aborted ? 'Applying covers timed out. Your original has not been sent to Gemma.' :
        failure instanceof Error ? failure.message : 'The covers could not be applied.');
    } finally { clearTimeout(timeout); request.current = null; setBusy(false); }
  }
  function close() { request.current?.abort(); if (!busy) onClose(); }
  return <Modal visible animationType="none" onRequestClose={close}>
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title} accessibilityRole="header">Review your photo</Text>
        <Text style={s.body}>Detected faces and number plates are covered. Check the whole photo for anything missed.</Text>
        {adjusting && drawing && <Text style={s.body}>Drag over a private detail to cover it.</Text>}
        <View style={[s.canvas, { width, height }]} accessible={false}
          onStartShouldSetResponder={() => adjusting && drawing && !busy && ready && regions.length < 100}
          onMoveShouldSetResponder={() => adjusting && drawing && !busy && ready && regions.length < 100}
          onResponderGrant={event => {
            start.current = point(event.nativeEvent.locationX, event.nativeEvent.locationY);
            setDraft(null); setChecked(false);
          }}
          onResponderMove={event => {
            if (start.current) setDraft(drawnRegion(start.current, point(event.nativeEvent.locationX, event.nativeEvent.locationY)));
          }}
          onResponderRelease={event => {
            if (start.current) {
              const region = drawnRegion(start.current, point(event.nativeEvent.locationX, event.nativeEvent.locationY));
              if (region.width * width >= 4 && region.height * height >= 4) { edit([...regions, region]); setSelected(regions.length); setDrawing(false); }
            }
            start.current = null; setDraft(null);
          }}
          onResponderTerminate={() => { start.current = null; setDraft(null); }}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" cachePolicy="none"
            accessible={false} onLoad={() => setReady(true)} onError={() => { setReady(false); setError('The photo could not be displayed. Cancel and choose it again.'); }}/>
          {[...regions, ...(draft ? [draft] : [])].map((region, i) => <View key={i} pointerEvents="none"
            style={{ position: 'absolute', left: region.x * width, top: region.y * height,
              width: region.width * width, height: region.height * height, backgroundColor: '#000000' }}/>) }
        </View>
        <Text style={s.body}>{regions.length ? `${regions.length} covers applied in this preview.` : 'No faces or plates were detected. Check for private details before continuing.'}</Text>
        <Action text={adjusting ? 'Done adjusting' : 'Adjust covers'} disabled={busy || !ready}
          onPress={() => { setAdjusting(!adjusting); setDrawing(false); }}/>
        {adjusting && <View style={s.tools}>
          <View style={s.controls}>
            <Action text={drawing ? 'Stop drawing' : 'Draw a cover'} disabled={busy || regions.length >= 100} onPress={() => setDrawing(!drawing)}/>
            <Action text="Add cover" disabled={busy || regions.length >= 100} onPress={() => { edit([...regions, {x:.35,y:.35,width:.3,height:.3,kind:'manual'}]); setSelected(regions.length); setDrawing(false); }}/>
          </View>
          <Text style={s.body}>Choose a cover to move, resize or remove it.</Text>
          <View style={s.controls}>{regions.map((region,i) => <Pressable key={i} accessibilityRole="button" accessibilityState={{selected:selected===i,disabled:busy}} disabled={busy}
            onPress={() => setSelected(i)} style={[s.action,selected===i && s.selected]}><Text style={s.actionText}>{region.kind==='face'?'Face':region.kind==='plate'?'Plate':'Cover'} {i+1}</Text></Pressable>)}</View>
          {selected!==null && regions[selected] && <View style={s.controls}>
            {(['Left','Right','Up','Down','Larger','Smaller'] as const).map(direction => <Action key={direction} text={direction} disabled={busy} onPress={() => edit(regions.map((old,i) => {
              if(i!==selected)return old;
              if(direction==='Larger'||direction==='Smaller'){
                const delta=direction==='Larger'?.02:-.02;
                const nextWidth=Math.max(.01,Math.min(1,old.width+delta*2)),nextHeight=Math.max(.01,Math.min(1,old.height+delta*2));
                return {...old,width:nextWidth,height:nextHeight,x:Math.max(0,Math.min(1-nextWidth,old.x+(old.width-nextWidth)/2)),y:Math.max(0,Math.min(1-nextHeight,old.y+(old.height-nextHeight)/2))};
              }
              return {...old,x:Math.max(0,Math.min(1-old.width,old.x+(direction==='Left'?-.03:direction==='Right'?.03:0))),y:Math.max(0,Math.min(1-old.height,old.y+(direction==='Up'?-.03:direction==='Down'?.03:0)))};
            }))}/>) }
            <Action text="Remove selected cover" disabled={busy} onPress={() => {edit(regions.filter((_,i)=>i!==selected));setSelected(null);}}/>
          </View>}
        </View>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy || !ready}
          onPress={() => setChecked(!checked)} style={s.confirm}>
          <Text style={s.actionText}>{checked ? '☑' : '☐'} I checked the photo and its covers.</Text>
        </Pressable>
        {!!error && <Text accessibilityLiveRegion="assertive" style={s.error}>{error}</Text>}
        {busy && <Text accessibilityLiveRegion="polite" style={s.body}>Applying covers to the image…</Text>}
        <Action text="Use this photo" primary disabled={!checked || !ready || busy} onPress={() => void apply()}/>
        <Action text="Cancel without applying" disabled={busy} onPress={close}/>
        <Text style={s.body}>Continuing creates a new image with permanent covers. It will only be sent to Gemma when you tap Analyse.</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg }, content: { padding: 20, gap: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: c.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: c.muted },
  canvas: { alignSelf: 'center', overflow: 'hidden', backgroundColor: c.white },
  action: { minHeight: 48, padding: 12, justifyContent: 'center', borderRadius: 14, backgroundColor: c.mint },
  actionText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: c.teal },
  primary: {backgroundColor: c.blue, alignItems:'center'}, primaryText: {color:c.white},
  selected: {borderWidth:2,borderColor:c.teal}, tools: {gap:12},
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, region: { gap: 8 },
  confirm: { minHeight: 56, padding: 16, backgroundColor: c.mint, borderRadius: 16 },
  error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: c.amber },
});
