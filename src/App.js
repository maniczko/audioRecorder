import { useState, useRef, useEffect, useCallback } from "react";

const API_KEY = "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";
const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s)%60).padStart(2,"0")}`;
const SPEAKER_COLORS = ["#7dd3c8","#f4a56a","#a8d8a8","#f9d56e","#c3aed6","#f08080"];
const SPEAKER_NAMES_DEFAULT = ["Mówca A","Mówca B","Mówca C","Mówca D","Mówca E","Mówca F"];

const getRecordingName = (index) => {
  const now = new Date();
  const date = now.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit",year:"2-digit"});
  const time = now.toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"});
  return `Nagranie ${index+1} · ${date} ${time}`;
};

function DanubeBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return undefined;
    let frame = 0, raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);
      const bg = ctx.createLinearGradient(0,0,0,h);
      bg.addColorStop(0,"#061a2e"); bg.addColorStop(0.5,"#0a2a40"); bg.addColorStop(1,"#071520");
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
      const waves = [
        {amp:28,period:0.008,speed:0.018,y:h*0.38,alpha:0.13,color:"#1a6b8a",thick:80},
        {amp:18,period:0.012,speed:0.025,y:h*0.50,alpha:0.18,color:"#1e7fa0",thick:60},
        {amp:22,period:0.009,speed:0.015,y:h*0.62,alpha:0.15,color:"#155f7a",thick:70},
        {amp:12,period:0.016,speed:0.030,y:h*0.72,alpha:0.22,color:"#2596be",thick:45},
        {amp:16,period:0.011,speed:0.020,y:h*0.82,alpha:0.20,color:"#1a8aad",thick:55},
        {amp:8, period:0.020,speed:0.038,y:h*0.90,alpha:0.28,color:"#3ab0d4",thick:30},
      ];
      waves.forEach(({amp,period,speed,y,alpha,color,thick}) => {
        ctx.beginPath(); ctx.moveTo(0,h);
        for(let x=0;x<=w;x+=2){
          const dy = Math.sin(x*period+frame*speed)*amp + Math.sin(x*period*1.7+frame*speed*0.6)*amp*0.4;
          ctx.lineTo(x,y+dy);
        }
        ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath();
        const grad = ctx.createLinearGradient(0,y-amp,0,y+thick);
        grad.addColorStop(0,color+Math.round(alpha*255).toString(16).padStart(2,"0"));
        grad.addColorStop(1,"transparent");
        ctx.fillStyle=grad; ctx.fill();
      });
      for(let i=0;i<6;i++){
        const waveY=h*(0.35+i*0.1);
        const sx=((frame*(0.4+i*0.15)+i*120)%(w+200))-100;
        ctx.save(); ctx.globalAlpha=0.06+Math.sin(frame*0.04+i)*0.03;
        ctx.strokeStyle="#7dd3c8"; ctx.lineWidth=1; ctx.beginPath();
        ctx.moveTo(sx,waveY-4); ctx.lineTo(sx+60+i*10,waveY+4); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha=0.07; ctx.fillStyle="#0d3a52";
      const buildings=[[0.05,0.32,0.04,0.08],[0.10,0.28,0.03,0.12],[0.14,0.30,0.05,0.10],[0.20,0.25,0.03,0.13],[0.24,0.29,0.04,0.09],[0.30,0.26,0.02,0.12],[0.33,0.22,0.03,0.16],[0.37,0.27,0.04,0.11],[0.43,0.24,0.03,0.14],[0.47,0.30,0.05,0.08],[0.54,0.23,0.03,0.15],[0.58,0.28,0.04,0.10],[0.63,0.25,0.02,0.13],[0.66,0.21,0.03,0.17],[0.70,0.27,0.04,0.11],[0.75,0.24,0.03,0.14],[0.79,0.29,0.05,0.09],[0.85,0.26,0.03,0.12],[0.89,0.30,0.04,0.08],[0.93,0.27,0.03,0.11],[0.97,0.31,0.04,0.07]];
      buildings.forEach(([x,y,bw,bh])=>ctx.fillRect(x*w,y*h,bw*w,bh*h));
      ctx.beginPath(); ctx.moveTo(0.335*w,0.22*h); ctx.lineTo(0.342*w,0.14*h); ctx.lineTo(0.349*w,0.22*h); ctx.fill();
      ctx.restore();
      frame++; raf=requestAnimationFrame(draw);
    };
    draw();
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none"}}/>;
}

const CustomAudioPlayer = ({ src, duration }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const togglePlay = () => { if(isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); };
  const handleTimeUpdate = () => {
    const c = audioRef.current.currentTime; setCurrentTime(c);
    if(audioRef.current.duration) setProgress((c/audioRef.current.duration)*100);
  };
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX-rect.left)/rect.width)*(audioRef.current.duration||duration);
  };
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(10,35,50,0.5)",padding:"7px 12px",borderRadius:6,border:"1px solid rgba(125,211,200,0.12)",marginTop:5}}>
      <button onClick={togglePlay} style={{width:24,height:24,borderRadius:"50%",background:"rgba(125,211,200,0.1)",border:"1px solid rgba(125,211,200,0.35)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#7dd3c8",flexShrink:0}}>
        <span style={{fontSize:9,marginLeft:isPlaying?0:1}}>{isPlaying?"⏸":"▶"}</span>
      </button>
      <div style={{flex:1,height:3,background:"rgba(10,20,30,0.7)",borderRadius:2,cursor:"pointer",position:"relative",overflow:"hidden"}} onClick={handleSeek}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${progress}%`,background:"#7dd3c8",transition:"width 0.1s linear"}}/>
      </div>
      <div style={{fontSize:9,color:"rgba(125,211,200,0.5)",fontFamily:"monospace",whiteSpace:"nowrap"}}>{formatTime(currentTime)}/{formatTime(duration)}</div>
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} onEnded={()=>setIsPlaying(false)}/>
    </div>
  );
};

export default function App() {
  const [isRecording,setIsRecording]=useState(false);
  // FIX 1: elapsed tylko rośnie gdy nagrywanie aktywne
  const [elapsed,setElapsed]=useState(0);
  const [visualData,setVisualData]=useState(new Array(44).fill(2));
  const [segments,setSegments]=useState([]); // segmenty bieżącej sesji
  const [analysisStatus,setAnalysisStatus]=useState(null);
  const [recordings,setRecordings]=useState([]);
  const [speakerNames,setSpeakerNames]=useState({});
  const [editingSpeaker,setEditingSpeaker]=useState(null);
  const [permission,setPermission]=useState("idle");
  const [liveText,setLiveText]=useState("");
  const [summary,setSummary]=useState("");
  const [voiceCmd,setVoiceCmd]=useState("");
  const [cmdFlash,setCmdFlash]=useState(false);
  const [speakerCount,setSpeakerCount]=useState(null);
  // FIX 2: wybrane nagranie do podglądu transkrypcji (null = bieżąca sesja)
  const [selectedRecId,setSelectedRecId]=useState(null);

  const mediaRecorderRef=useRef(null);
  const chunksRef=useRef([]);
  const streamRef=useRef(null);
  const analyserRef=useRef(null);
  const animFrameRef=useRef(null);
  const timerRef=useRef(null);
  const startTimeRef=useRef(null);
  const transcriptRef=useRef([]);
  const transcriptEndRef=useRef(null);
  const currentSpeakerRef=useRef(0);
  const lastSpeechTimeRef=useRef(Date.now());
  const isRecordingRef=useRef(false);
  const funcsRef=useRef({});
  const recordingsCountRef=useRef(0);

  useEffect(()=>{isRecordingRef.current=isRecording;},[isRecording]);

  const drawBars=useCallback(()=>{
    if(!analyserRef.current)return;
    const data=new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setVisualData(Array.from({length:44},(_,i)=>Math.max(2,(data[Math.floor(i*data.length/44)]/255)*72)));
    animFrameRef.current=requestAnimationFrame(drawBars);
  },[]);

  const addSegment=useCallback((text,speakerId,timestamp)=>{
    const seg={id:Date.now()+Math.random(),text,speakerId,timestamp};
    transcriptRef.current=[...transcriptRef.current,seg];
    setSegments([...transcriptRef.current]);
  },[]);

  const autoAnalyze=useCallback(async(segs)=>{
    if(!segs||segs.length===0)return;
    setAnalysisStatus("analyzing"); setSpeakerNames({}); setSummary(""); setSpeakerCount(null);
    try{
      const raw=segs.map(s=>`[${formatTime(s.timestamp)}] Mowca${s.speakerId}: ${s.text}`).join("\n");
      const uniqueIds=[...new Set(segs.map(s=>s.speakerId))];
      const prompt=`Jesteś ekspertem analizy rozmów. Przeanalizuj dokładnie poniższy transkrypt.

ZADANIE 1 - WERYFIKACJA ROZMÓWCÓW:
Czy to jest jedna osoba mówiąca (monolog), czy RÓŻNE osoby rozmawiające ze sobą?
Unikalne ID mówców w transkrypcie (wykryte wstępnie na podstawie pauz - może być błędne): ${uniqueIds.join(", ")}

ZADANIE 2 - PRZYPISANIE NAZW:
Jeśli JEDNA osoba: wszystkim ID przypisz tę samą nazwę (np. "Monolog" lub imię jeśli się przedstawia).
Jeśli WIELE osób: przypisz sensowne role (np. "Prowadzący", "Ekspert", "Klient").

ZADANIE 3 - PODSUMOWANIE:
Napisz po polsku 2-4 zdania o czym było to nagranie. Uwzględnij główne tematy i wnioski.

Zwróć WYŁĄCZNIE poprawny JSON:
{"speakerCount":<liczba całkowita>,"speakers":{"0":"Nazwa",...},"summary":"Podsumowanie po polsku."}

Transkrypt:
${raw}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:1000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const rawText=data.content?.[0]?.text||"";
      const jsonMatch=rawText.match(/\{[\s\S]*\}/);
      if(!jsonMatch) throw new Error("No JSON");
      const parsed=JSON.parse(jsonMatch[0]);
      if(parsed.speakers) setSpeakerNames(parsed.speakers);
      if(parsed.summary) setSummary(parsed.summary);
      if(parsed.speakerCount) setSpeakerCount(parsed.speakerCount);
      setAnalysisStatus("done");
    }catch(e){ console.error(e); setAnalysisStatus("error"); }
  },[]);

  const startRecordingFn=async()=>{
    if(isRecordingRef.current) return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current=stream; setPermission("granted");
      transcriptRef.current=[]; setSegments([]); setSummary("");
      setSpeakerNames({}); setSpeakerCount(null); setAnalysisStatus(null);
      // Przy nowym nagraniu wracamy do widoku bieżącej sesji
      setSelectedRecId(null);
      currentSpeakerRef.current=0;

      const audioCtx=new AudioContext();
      const source=audioCtx.createMediaStreamSource(stream);
      const analyser=audioCtx.createAnalyser();
      analyser.fftSize=256; source.connect(analyser); analyserRef.current=analyser;

      const recorder=new MediaRecorder(stream);
      mediaRecorderRef.current=recorder; chunksRef.current=[];
      recorder.ondataavailable=(e)=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      recorder.onstop=()=>{
        const blob=new Blob(chunksRef.current,{type:"audio/webm"});
        const idx=recordingsCountRef.current++;
        const recId=Date.now();
        const finalSegs=[...transcriptRef.current];
        setRecordings(prev=>[...prev,{
          id:recId, url:URL.createObjectURL(blob), blob,
          duration:Math.floor((Date.now()-startTimeRef.current)/1000),
          name:getRecordingName(idx),
          transcript:finalSegs,
          speakerNames:{}, summary:"", speakerCount:null,
        }]);
        cancelAnimationFrame(animFrameRef.current);
        setVisualData(new Array(44).fill(2));
        setTimeout(()=>autoAnalyze(finalSegs),400);
      };
      recorder.start();

      // FIX 1: czyść stary timer przed nowym + reset elapsed
      clearInterval(timerRef.current);
      setElapsed(0);
      startTimeRef.current=Date.now(); lastSpeechTimeRef.current=Date.now();
      setIsRecording(true); isRecordingRef.current=true;
      timerRef.current=setInterval(()=>{
        // Tylko aktualizuj jeśli nadal nagrywamy
        if(isRecordingRef.current){
          setElapsed(Math.floor((Date.now()-startTimeRef.current)/1000));
        }
      },500);
      drawBars();
    }catch{ setPermission("denied"); }
  };

  const stopRecordingFn=()=>{
    if(!isRecordingRef.current) return;
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    // FIX 1: natychmiast zatrzymaj timer
    clearInterval(timerRef.current);
    timerRef.current=null;
    setIsRecording(false); isRecordingRef.current=false; setLiveText("");
  };

  useEffect(()=>{ funcsRef.current={start:startRecordingFn,stop:stopRecordingFn,addSegment}; });

  // Synchronizuj wyniki analizy do nagrania po zakończeniu
  useEffect(()=>{
    if(analysisStatus!=="done") return;
    setRecordings(prev=>{
      if(prev.length===0) return prev;
      const lastId=prev[prev.length-1].id;
      return prev.map(r=>r.id===lastId
        ? {...r, speakerNames, summary, speakerCount}
        : r
      );
    });
  },[analysisStatus, speakerNames, summary, speakerCount]);

  // Speech recognition
  useEffect(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR) return;
    const recognition=new SR();
    recognition.continuous=true; recognition.interimResults=true; recognition.lang="pl-PL";
    recognition.onresult=(e)=>{
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const res=e.results[i];
        const text=res[0].transcript;
        const lower=text.toLowerCase().trim();
        if(lower.includes("start")&&!isRecordingRef.current){
          setVoiceCmd("START"); setCmdFlash(true); setTimeout(()=>setCmdFlash(false),1400);
          funcsRef.current.start(); return;
        }
        if(lower.includes("stop")&&isRecordingRef.current){
          setVoiceCmd("STOP"); setCmdFlash(true); setTimeout(()=>setCmdFlash(false),1400);
          funcsRef.current.stop(); return;
        }
        if(res.isFinal){
          if(!isRecordingRef.current) continue;
          const clean=text.trim(); if(!clean) continue;
          const now=Date.now(); const gap=now-lastSpeechTimeRef.current;
          if(gap>2500&&transcriptRef.current.length>0){
            const prev=transcriptRef.current[transcriptRef.current.length-1];
            if(prev) currentSpeakerRef.current=(prev.speakerId+1)%6;
          }
          lastSpeechTimeRef.current=now;
          funcsRef.current.addSegment(clean,currentSpeakerRef.current,Math.floor((now-startTimeRef.current)/1000));
          setLiveText("");
        } else {
          if(isRecordingRef.current) interim+=text;
        }
      }
      if(interim&&isRecordingRef.current) setLiveText(interim);
    };
    recognition.onend=()=>{ try{ recognition.start(); }catch{} };
    try{ recognition.start(); }catch{}
    return()=>{ recognition.onend=null; recognition.abort(); };
  },[]);

  // FIX 2: dane do wyświetlenia — bieżąca sesja lub wybrane nagranie
  const selectedRec = selectedRecId ? recordings.find(r=>r.id===selectedRecId) : null;
  const displaySegments = selectedRec ? selectedRec.transcript : segments;
  const displaySpeakerNames = selectedRec ? selectedRec.speakerNames : speakerNames;
  const displaySummary = selectedRec ? selectedRec.summary : summary;
  const displaySpeakerCount = selectedRec ? selectedRec.speakerCount : speakerCount;
  const displayAnalysisStatus = selectedRec ? (selectedRec.summary ? "done" : null) : analysisStatus;

  const getSpeakerLabel=(id,names)=>(names||displaySpeakerNames)[String(id)]||SPEAKER_NAMES_DEFAULT[id]||`Mówca ${id+1}`;
  const getSpeakerColor=(id)=>SPEAKER_COLORS[id%SPEAKER_COLORS.length];
  const uniqueSpeakers=[...new Set(displaySegments.map(s=>s.speakerId))];

  const downloadTranscript=()=>{
    const text=displaySegments.map(s=>`[${formatTime(s.timestamp)}] ${getSpeakerLabel(s.speakerId,displaySpeakerNames)}: ${s.text}`).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
    a.download="transkrypcja.txt"; a.click();
  };

  useEffect(()=>{ if(!selectedRecId) transcriptEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selectedRecId, segments, liveText]);
  useEffect(()=>()=>{ cancelAnimationFrame(animFrameRef.current); clearInterval(timerRef.current); },[]);

  return (
    <div style={{minHeight:"100vh",fontFamily:"'IBM Plex Mono','Courier New',monospace",color:"#d4ede9",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a4a5a;border-radius:2px}
        .glass{background:rgba(5,20,35,0.75);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(100,200,220,0.08);}
        .rec-btn{width:72px;height:72px;border-radius:50%;border:1.5px solid rgba(125,211,200,0.6);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;outline:none;flex-shrink:0;}
        .rec-btn:hover{background:rgba(125,211,200,0.08);border-color:rgba(125,211,200,0.9);}
        .bar{border-radius:1px;transition:height 0.05s;width:3px;}
        .seg{padding:10px 14px;border-radius:6px;background:rgba(5,25,40,0.6);border-left:2px solid;margin-bottom:6px;animation:fadeIn 0.3s ease;backdrop-filter:blur(8px);}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .tab{background:transparent;border:none;cursor:pointer;padding:8px 18px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:rgba(180,220,215,0.35);transition:color 0.2s;text-transform:uppercase;border-bottom:1.5px solid transparent;}
        .tab.active{color:#7dd3c8;border-bottom-color:#7dd3c8;}
        .icon-btn{background:rgba(10,40,60,0.5);border:1px solid rgba(100,200,220,0.15);cursor:pointer;color:rgba(125,211,200,0.55);padding:6px 14px;border-radius:4px;font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:1px;transition:all 0.2s;backdrop-filter:blur(8px);}
        .icon-btn:hover{color:#7dd3c8;border-color:rgba(125,211,200,0.4);background:rgba(10,50,70,0.6);}
        .icon-btn:disabled{opacity:0.4;cursor:not-allowed;}
        .live-text{padding:8px 14px;border-radius:4px;background:rgba(5,25,40,0.4);border-left:2px solid rgba(100,180,200,0.2);color:rgba(180,220,215,0.4);font-style:italic;font-size:12px;}
        input.speaker-edit{background:transparent;border:none;border-bottom:1px solid #7dd3c8;color:#d4ede9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;width:110px;}
        @keyframes cmdAnim{0%{opacity:0;transform:translateX(-50%) translateY(-8px) scale(0.95)}15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.03)}85%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-4px) scale(0.97)}}
        @keyframes dotBlink{0%,100%{opacity:0.3}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rec-item{padding:10px 12px;border-radius:6px;border:1px solid rgba(100,200,220,0.08);cursor:pointer;transition:all 0.15s;margin-bottom:8px;}
        .rec-item:hover{border-color:rgba(125,211,200,0.25);background:rgba(10,40,60,0.3);}
        .rec-item.active{border-color:rgba(125,211,200,0.45);background:rgba(10,50,70,0.45);}
      `}</style>

      <DanubeBackground/>

      {cmdFlash&&(
        <div style={{position:"fixed",top:24,left:"50%",zIndex:200,animation:"cmdAnim 1.4s ease forwards",background:"rgba(8,35,55,0.96)",border:"1px solid rgba(125,211,200,0.5)",borderRadius:8,padding:"10px 28px",fontSize:12,letterSpacing:4,color:"#7dd3c8",backdropFilter:"blur(16px)",pointerEvents:"none",whiteSpace:"nowrap"}}>
          {voiceCmd==="START"?"▸ KOMENDA: START":"■ KOMENDA: STOP"}
        </div>
      )}

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

        {/* Top bar */}
        <div className="glass" style={{padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:"none",borderRight:"none",borderTop:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(125,211,200,0.6)",textTransform:"uppercase"}}>◉ VoiceLog</div>
            <div style={{width:1,height:14,background:"rgba(125,211,200,0.15)"}}/>
            <div style={{fontSize:9,letterSpacing:2,color:"rgba(125,211,200,0.3)"}}>DUNAJ · {new Date().toLocaleDateString("pl-PL")}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:9,color:"rgba(125,211,200,0.3)",letterSpacing:1,display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"rgba(125,211,200,0.5)",animation:"dotBlink 2s infinite"}}/>
              NASŁUCH: "start" / "stop"
            </div>
            {displaySegments.length>0&&(
              <button className="icon-btn" onClick={downloadTranscript}>⬇ .txt</button>
            )}
          </div>
        </div>

        <div style={{display:"flex",flex:1,overflow:"hidden"}}>

          {/* LEFT panel */}
          <div className="glass" style={{width:270,borderTop:"none",borderBottom:"none",borderLeft:"none",padding:"24px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:16,flexShrink:0,overflowY:"auto"}}>

            {/* Visualizer */}
            <div style={{width:"100%",height:56,display:"flex",alignItems:"flex-end",gap:2}}>
              {visualData.map((h,i)=>(
                <div key={i} className="bar" style={{height:h,flex:1,background:isRecording?`hsl(${175+i*1.5},55%,${45+Math.sin(i*0.3)*10}%)`:"rgba(100,180,200,0.1)"}}/>
              ))}
            </div>

            {/* Timer — FIX 1: nie pokazuje elapsed gdy nie nagrywa (po stop zostaje na ostatniej wartości) */}
            <div style={{fontFamily:"'IBM Plex Mono'",fontSize:34,fontWeight:600,color:isRecording?"#7dd3c8":"rgba(100,180,200,0.2)",letterSpacing:3,transition:"color 0.4s",textShadow:isRecording?"0 0 30px rgba(125,211,200,0.3)":"none"}}>
              {isRecording ? formatTime(elapsed) : "00:00"}
            </div>

            {/* Record button */}
            <button className="rec-btn" onClick={isRecording?stopRecordingFn:startRecordingFn}
              style={{boxShadow:isRecording?"0 0 24px rgba(125,211,200,0.2)":"none"}}>
              <div style={{width:isRecording?22:34,height:isRecording?22:34,borderRadius:isRecording?3:"50%",background:"rgba(125,211,200,0.85)",transition:"all 0.25s",boxShadow:isRecording?"0 0 16px rgba(125,211,200,0.5)":"none"}}/>
            </button>

            <div style={{fontSize:9,color:"rgba(125,211,200,0.35)",letterSpacing:2,textAlign:"center"}}>
              {permission==="denied"?"BRAK DOSTĘPU DO MIKROFONU":isRecording?"● NAGRYWANIE...":"KLIKNIJ LUB POWIEDZ START"}
            </div>

            {/* Analysis status (tylko bieżąca sesja) */}
            {!selectedRecId && analysisStatus && (
              <div style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:"rgba(5,25,40,0.6)",borderRadius:5,border:`1px solid ${analysisStatus==="done"?"rgba(168,216,168,0.25)":analysisStatus==="error"?"rgba(240,128,128,0.25)":"rgba(249,213,110,0.2)"}`}}>
                {analysisStatus==="analyzing"&&<div style={{width:12,height:12,border:"2px solid rgba(249,213,110,0.3)",borderTopColor:"#f9d56e",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>}
                <span style={{fontSize:10,color:analysisStatus==="done"?"#a8d8a8":analysisStatus==="error"?"#f08080":"#f9d56e",letterSpacing:1}}>
                  {analysisStatus==="analyzing"?"Claude analizuje...":analysisStatus==="done"?"✓ Analiza gotowa":"⚠ Błąd analizy"}
                </span>
              </div>
            )}

            {/* Speaker count */}
            {displaySpeakerCount!==null&&displayAnalysisStatus==="done"&&(
              <div style={{width:"100%",padding:"8px 12px",background:"rgba(5,30,50,0.5)",borderRadius:6,border:"1px solid rgba(125,211,200,0.12)",textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(125,211,200,0.35)",letterSpacing:2,marginBottom:2}}>WYKRYTO</div>
                <div style={{fontSize:22,fontWeight:600,color:"#7dd3c8"}}>{displaySpeakerCount}</div>
                <div style={{fontSize:9,color:"rgba(125,211,200,0.35)",letterSpacing:1}}>{displaySpeakerCount===1?"rozmówca":"rozmówców"}</div>
              </div>
            )}

            {/* Speakers legend */}
            {uniqueSpeakers.length>0&&displayAnalysisStatus==="done"&&(
              <div style={{width:"100%",borderTop:"1px solid rgba(100,200,220,0.07)",paddingTop:12}}>
                <div style={{fontSize:9,color:"rgba(125,211,200,0.3)",letterSpacing:2,marginBottom:10}}>MÓWCY</div>
                {uniqueSpeakers.map(id=>(
                  <div key={id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:getSpeakerColor(id),flexShrink:0,boxShadow:`0 0 6px ${getSpeakerColor(id)}55`}}/>
                    {!selectedRecId&&editingSpeaker===id?(
                      <input className="speaker-edit" defaultValue={getSpeakerLabel(id,displaySpeakerNames)} autoFocus
                        onBlur={e=>{setSpeakerNames(p=>({...p,[String(id)]:e.target.value}));setEditingSpeaker(null);}}
                        onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}/>
                    ):(
                      <span style={{fontSize:11,color:getSpeakerColor(id),cursor:selectedRecId?"default":"pointer",opacity:0.85}}
                        onClick={()=>!selectedRecId&&setEditingSpeaker(id)}>
                        {getSpeakerLabel(id,displaySpeakerNames)}{!selectedRecId&&<span style={{opacity:0.3,fontSize:9}}> ✎</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {displaySummary&&(
              <div style={{width:"100%",padding:12,background:"rgba(5,30,50,0.6)",borderRadius:6,border:"1px solid rgba(125,211,200,0.1)"}}>
                <div style={{fontSize:9,color:"rgba(125,211,200,0.35)",letterSpacing:2,marginBottom:7}}>✦ PODSUMOWANIE</div>
                <div style={{fontSize:12,color:"rgba(190,225,220,0.7)",lineHeight:1.75,fontFamily:"'IBM Plex Sans',sans-serif",fontWeight:300}}>{displaySummary}</div>
              </div>
            )}

            {/* FIX 2: Lista nagrań z możliwością wyboru */}
            {recordings.length>0&&(
              <div style={{width:"100%",borderTop:"1px solid rgba(100,200,220,0.07)",paddingTop:12}}>
                <div style={{fontSize:9,color:"rgba(125,211,200,0.3)",letterSpacing:2,marginBottom:10}}>
                  NAGRANIA ({recordings.length})
                </div>
                {recordings.map(r=>(
                  <div key={r.id}
                    className={`rec-item ${selectedRecId===r.id?"active":""}`}
                    onClick={()=>setSelectedRecId(selectedRecId===r.id?null:r.id)}
                  >
                    {/* Nagłówek nagrania */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                      <div style={{fontSize:10,color:selectedRecId===r.id?"#7dd3c8":"rgba(180,220,215,0.55)",lineHeight:1.4,flex:1}}>{r.name}</div>
                      <div style={{fontSize:9,color:"rgba(125,211,200,0.3)",marginLeft:6,flexShrink:0}}>{formatTime(r.duration)}</div>
                    </div>
                    {/* Badges */}
                    <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                      {r.speakerCount&&(
                        <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:"rgba(125,211,200,0.08)",color:"rgba(125,211,200,0.5)",letterSpacing:1}}>
                          {r.speakerCount} {r.speakerCount===1?"os.":"os."}
                        </span>
                      )}
                      {r.transcript.length>0&&(
                        <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:"rgba(125,211,200,0.06)",color:"rgba(125,211,200,0.4)",letterSpacing:1}}>
                          {r.transcript.length} segm.
                        </span>
                      )}
                      {selectedRecId===r.id&&(
                        <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:"rgba(125,211,200,0.15)",color:"#7dd3c8",letterSpacing:1}}>
                          ← podgląd
                        </span>
                      )}
                    </div>
                    {/* Player */}
                    <CustomAudioPlayer src={r.url} duration={r.duration}/>
                  </div>
                ))}

                {/* Przycisk powrotu do bieżącej sesji */}
                {selectedRecId&&(
                  <button className="icon-btn" style={{width:"100%",marginTop:6,justifyContent:"center",display:"flex"}}
                    onClick={()=>setSelectedRecId(null)}>
                    ← bieżąca sesja
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — transcript */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Tab bar z info o wybranym nagraniu */}
            <div className="glass" style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:"none",borderRight:"none",borderTop:"none",padding:"0 24px"}}>
              <div style={{display:"flex"}}>
                <button className="tab active">Transkrypt</button>
              </div>
              {selectedRecId&&(
                <div style={{fontSize:9,color:"rgba(125,211,200,0.4)",letterSpacing:1,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:"rgba(125,211,200,0.4)",display:"inline-block"}}/>
                  {recordings.find(r=>r.id===selectedRecId)?.name}
                </div>
              )}
            </div>

            <div style={{flex:1,overflow:"auto",padding:"24px"}}>

              {/* Pusta sesja */}
              {displaySegments.length===0&&!liveText&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"80%",gap:16}}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{opacity:0.08}}>
                    <circle cx="24" cy="24" r="22" stroke="#7dd3c8" strokeWidth="1"/>
                    <path d="M8 24 Q16 16 24 24 Q32 32 40 24" stroke="#7dd3c8" strokeWidth="1.5" fill="none"/>
                    <path d="M8 28 Q16 20 24 28 Q32 36 40 28" stroke="#7dd3c8" strokeWidth="1" fill="none"/>
                  </svg>
                  <div style={{fontSize:10,color:"rgba(125,211,200,0.2)",letterSpacing:2,textAlign:"center",lineHeight:2.2}}>
                    {selectedRecId?"TO NAGRANIE NIE MA TRANSKRYPCJI":"NACIŚNIJ NAGRAJ LUB POWIEDZ START"}<br/>
                    {!selectedRecId&&"TRANSKRYPCJA I ANALIZA STARTUJĄ AUTOMATYCZNIE"}
                  </div>
                </div>
              )}

              {/* Spinner analizy w transkrypcie (tylko bieżąca sesja) */}
              {!selectedRecId&&analysisStatus==="analyzing"&&displaySegments.length>0&&(
                <div style={{marginBottom:16,padding:"10px 16px",background:"rgba(249,213,110,0.05)",borderRadius:6,border:"1px solid rgba(249,213,110,0.12)",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:12,height:12,border:"2px solid rgba(249,213,110,0.3)",borderTopColor:"#f9d56e",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
                  <span style={{fontSize:11,color:"rgba(249,213,110,0.6)",letterSpacing:1}}>Claude analizuje rozmowę...</span>
                </div>
              )}

              {/* Segmenty */}
              <div>
                {displaySegments.map(seg=>(
                  <div key={seg.id} className="seg" style={{borderLeftColor:getSpeakerColor(seg.speakerId)}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:11,color:getSpeakerColor(seg.speakerId),fontWeight:600,textShadow:`0 0 10px ${getSpeakerColor(seg.speakerId)}44`}}>
                        {getSpeakerLabel(seg.speakerId,displaySpeakerNames)}
                      </span>
                      <span style={{fontSize:9,color:"rgba(125,211,200,0.2)"}}>{formatTime(seg.timestamp)}</span>
                    </div>
                    <div style={{fontSize:13,color:"rgba(200,230,225,0.75)",lineHeight:1.7,fontFamily:"'IBM Plex Sans',sans-serif",fontWeight:300}}>
                      {seg.text}
                    </div>
                  </div>
                ))}
                {!selectedRecId&&liveText&&(
                  <div className="live-text">
                    <span style={{fontSize:9,color:"rgba(125,211,200,0.3)",marginRight:8}}>na żywo</span>{liveText}
                  </div>
                )}
                {!selectedRecId&&<div ref={transcriptEndRef}/>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
