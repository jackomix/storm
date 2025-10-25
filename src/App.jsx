import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Edit2, Star, Download, X, Check, Sparkles, Zap, Settings, Dice6, List, LayoutList, Lightbulb, Flame, Upload, RotateCcw } from 'lucide-react';

// --- App Requires party-js ---
// <script src="https://cdn.jsdelivr.net/npm/party-js@latest/bundle/party.min.js"></script>

// --- 1. Centralized Constants & Config ---
const PILE_CONFIG = {
  concepts: { name: 'Concepts', icon: List, classes: { text: 'text-red-600', border: 'hover:border-red-400', bg: 'bg-red-50', borderInner: 'border-red-200' } },
  prompts: { name: 'Prompts', icon: LayoutList, classes: { text: 'text-blue-600', border: 'hover:border-blue-400', bg: 'bg-blue-50', borderInner: 'border-blue-200' } },
  ideas: { name: 'Ideas', icon: Lightbulb, classes: { text: 'text-green-600', border: 'hover:border-green-400', bg: 'bg-green-50', borderInner: 'border-green-200' } },
  starred: { name: 'Starred Ideas', icon: Star, classes: { text: 'text-amber-600', border: 'hover:border-amber-400', bg: 'bg-amber-50', borderInner: 'border-amber-300' } }
};

const STORAGE_KEYS = {
  DATA: 'videoIdeasData', SETTINGS: 'settings', LAST_NOTIF: 'lastNotif',
  LAST_DATE: 'lastDate', DAILY_STATS: 'dailyStats', CURRENT_TASK: 'currentTask',
  STREAK: 'videoIdeasStreak', LAST_STREAK_DATE: 'videoIdeasLastStreakDate'
};

const TASKS = {
    concepts: [
        "Write {N} concepts", "Write {N} concepts related to <concept>", "Write {N} concepts combining <concept> and <concept>",
        "Write {N} concepts based on <idea>", "Write {N} concepts inspired by the word <random_word>", "Write {N} concepts based on your last one <latest_item>",
    ],
    prompts: [ "Write {N} prompts", "Write {N} prompts about the topic <random_word>", ],
    ideas: [ "Write {N} ideas based on <prompt>", "Write {N} variations of the idea <idea>", "Write {N} ideas that are like <idea> but with <concept>", ]
};

const STREAK_MILESTONES = [7, 30, 100, 365, 500, 730, 1000];

const WORD_LIST = ["Technology", "Creativity", "Future", "History", "Science", "Art", "Productivity", "Health", "Finance", "Nature", "Space", "Psychology"];
const DEFAULT_SETTINGS = { notificationsEnabled: false, placeholder: 'XX', taskRanges: { concepts: [5, 8], prompts: [2, 5], ideas: [2, 6] } };
const DEFAULT_DAILY_STATS = { concepts: 0, prompts: 0, ideas: 0, tasks: 0 };
const INITIAL_DATA = { concepts: [], prompts: [], ideas: [] };
const INTERNAL_PLACEHOLDER = '{PLACEHOLDER}'; // Consistent internal representation

// --- App Version (from Vite config) ---
// Ensure this works even if __APP_VERSION__ is not defined during development
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';


// --- 2. Storage Utility ---
const store = {
  get: (key, fallback = null) => { try { const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; } catch { return fallback; } },
  set: (key, v) => localStorage.setItem(key, JSON.stringify(v)),
  remove: (key) => localStorage.removeItem(key),
};

// --- 3. Reusable Components (Defined outside main component) ---
const Button = React.forwardRef(({variant='default',children,className='',...props}, ref)=>{
    const base="px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
    const variants={
        default:'bg-blue-500 text-white hover:bg-blue-600',
        danger:'bg-red-500 text-white hover:bg-red-600',
        success:'bg-emerald-500 text-white hover:bg-emerald-600',
        secondary:'bg-zinc-200 text-zinc-800 hover:bg-zinc-300',
    };
    return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>
});

const IconButton=({children,className='',...props})=><button className={`p-2 bg-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-300 transition-colors ${className}`} {...props}>{children}</button>;

const StatCard=({pileKey,count,dailyCount,onClick})=>{
    const config=PILE_CONFIG[pileKey];
    return(
        <button onClick={onClick} className={`bg-white p-4 rounded-xl border border-zinc-200 ${config.classes.border} hover:shadow-lg transition-all text-center group transform hover:-translate-y-0.5`}>
            <h3 className="text-sm font-medium text-zinc-600 mb-1 flex items-center justify-center gap-1"><config.icon size={16} className={config.classes.text}/> {config.name}</h3>
            <p className={`text-3xl font-serif ${config.classes.text} group-hover:scale-105 transition-transform font-bold`}>{count}</p>
            {/* Added min-height to prevent layout shift */}
            <div className="min-h-[1.25rem] mt-2"> 
              {dailyCount > 0 && <p className={`text-xs ${config.classes.text} animate-pulse`}>+{dailyCount} today</p>}
            </div>
        </button>
    )
};

const Modal = ({ title, message, type, onConfirm, onCancel }) => {
    const confirmButtonRef = useRef(null);
    useEffect(() => {
      // Focus the confirm/OK button when the modal appears for keyboard accessibility
      if (confirmButtonRef.current) {
        confirmButtonRef.current.focus();
      }
    }, []);

    return (
      // Use a high z-index to appear above everything, including potential future overlays
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
        <div className="bg-white p-6 rounded-lg max-w-sm w-full m-4 shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-xl font-serif mb-3 text-zinc-800">{title}</h3>
          <p className="text-zinc-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            {type === 'confirm' && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
            <Button ref={confirmButtonRef} variant={type === 'confirm' ? 'danger' : 'default'} onClick={onConfirm}>
              {type === 'confirm' ? 'Confirm' : 'OK'}
            </Button>
          </div>
        </div>
      </div>
    );
};

const AnimatedProgressBar = React.memo(({ percentage }) => {
    const progressStyle = useMemo(() => {
        let colorGradient;
        if (percentage >= 100) colorGradient = 'linear-gradient(to right, #34d399, #22d3ee)'; // green-400 to cyan-400
        else if (percentage > 66) colorGradient = 'linear-gradient(to right, #2dd4bf, #10b981)'; // teal-400 to emerald-500
        else if (percentage > 33) colorGradient = 'linear-gradient(to right, #facc15, #f97316)'; // yellow-400 to orange-500
        else colorGradient = 'linear-gradient(to right, #ef4444, #f59e0b)'; // red-500 to amber-500
        
        return {
            width: `${percentage}%`,
            backgroundImage: colorGradient
        };
    }, [percentage]);

    return (
        <div className="progress-bar-container">
            <div
                className="progress-bar-fill"
                style={progressStyle}
            ></div>
        </div>
    );
});

// Helper component for dashed placeholder display
const DashedPlaceholder = () => (
    <span className="inline-block align-middle w-10 h-5 border-2 border-dashed border-purple-400 rounded mx-1"></span>
);

const Marquee = ({ items }) => { // Removed getPromptText prop
    // Helper to render placeholder visually in Marquee
    const renderPromptWithPlaceholder = (item) => {
        const text = item.rawText || item.text; // Use rawText for internal placeholder
        const parts = text.split(INTERNAL_PLACEHOLDER);
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && <DashedPlaceholder />}
            </React.Fragment>
        ));
    };

    const StyledMarqueeItem = ({ item, pile }) => {
        const config = PILE_CONFIG[pile];
        if (!config) return null;

        return (
            <div className={`inline-flex items-center ${config.classes.bg} border ${config.classes.borderInner} px-3 py-1 rounded-full text-sm mx-2 flex-shrink-0`}>
                <config.icon size={14} className={`${config.classes.text} mr-2`} />
                <p className="text-zinc-800 truncate max-w-[200px]">
                    {pile === 'prompts' ? renderPromptWithPlaceholder(item) : item.text}
                </p>
            </div>
        );
    };

    if (!items || items.length === 0) return null;

    const shuffledItems = useMemo(() => [...items].sort(() => 0.5 - Math.random()), [items]);
    const marqueeItems = [...shuffledItems, ...shuffledItems]; // Duplicate for seamless scroll

    return (
        <div className="marquee-container">
            <div className="marquee-content">
                {marqueeItems.map((item, index) => (
                    <StyledMarqueeItem key={`${item.id}-${index}`} item={item} pile={item.pile} />
                ))}
            </div>
        </div>
    );
};


// --- Main App Component ---
const VideoIdeasApp = () => {
  // --- State Management ---
  const [data, setData] = useState(() => store.get(STORAGE_KEYS.DATA, INITIAL_DATA));
  const [settings, setSettings] = useState(() => store.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS));
  const [view, setView] = useState('home'); // Default to home
  const [task, setTask] = useState(null); // Initialize task as null
  const [taskItems, setTaskItems] = useState([]); // Initialize task items as empty
  const [taskInput, setTaskInput] = useState('');
  const [editing, setEditing] = useState(null);
  const [dailyDone, setDailyDone] = useState(false);
  const [lastDate, setLastDate] = useState(() => store.get(STORAGE_KEYS.LAST_DATE));
  const [dailyStats, setDailyStats] = useState(() => store.get(STORAGE_KEYS.DAILY_STATS, DEFAULT_DAILY_STATS));
  const [sortBy, setSortBy] = useState('newest');
  const [manualAddItem, setManualAddItem] = useState({ show: false, pile: null, text: '' });
  const [modal, setModal] = useState(null);
  // No longer needed: const [showSettings, setShowSettings] = useState(false);
  const [streak, setStreak] = useState(0);
  const fileInputRef = useRef(null); // Ref for hidden file input

  // --- Persistence & Initialization ---
  useEffect(() => { store.set(STORAGE_KEYS.DATA, data); }, [data]);
  useEffect(() => { store.set(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
  
  // Save task only when task state is actively set (not on initial load finding nothing)
  useEffect(() => {
    if (task) { 
      store.set(STORAGE_KEYS.CURRENT_TASK, { ...task, items: taskItems });
    }
    // No else block needed here, removal happens on pagehide/visibilitychange now
  }, [task, taskItems]);

  useEffect(() => { // Initial Load - Handles PWA launch behavior
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/party-js@latest/bundle/party.min.js";
    script.async = true;
    document.body.appendChild(script);

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    // Check daily task status
    const lastDay = store.get(STORAGE_KEYS.LAST_DATE);
    if (lastDay === today) {
      setDailyDone(true);
      setDailyStats(store.get(STORAGE_KEYS.DAILY_STATS, DEFAULT_DAILY_STATS));
    } else {
      setDailyDone(false); setDailyStats(DEFAULT_DAILY_STATS);
      store.set(STORAGE_KEYS.LAST_DATE, today); // Set today as last active date
    }
    setLastDate(today);

    // Check streak status
    const lastStreakDay = store.get(STORAGE_KEYS.LAST_STREAK_DATE);
    const currentStreak = store.get(STORAGE_KEYS.STREAK, 0);

    if (lastStreakDay === today || lastStreakDay === yesterday) {
        setStreak(currentStreak);
    } else {
        // Reset streak if more than a day passed
        setStreak(0);
        store.set(STORAGE_KEYS.STREAK, 0);
        // Don't remove LAST_STREAK_DATE here, let daily reset handle it
    }

    // --- PWA Launch Logic ---
    // Always start on the home screen when the app loads fresh
    setView('home'); 
    store.remove(STORAGE_KEYS.CURRENT_TASK); // Clear any lingering task state
    setTask(null);
    setTaskItems([]);


    // --- Event listener to clear task on session end ---
    const handleSessionEnd = () => {
        // Only save task state if there is an active task
        if (taskRef.current) { // Use ref to get current task state
           console.log("Page hidden/closed, saving current task state.");
           store.set(STORAGE_KEYS.CURRENT_TASK, { ...taskRef.current, items: taskItemsRef.current }); // Use refs
        } else {
            // If no task is active when hidden, ensure it's cleared
             console.log("Page hidden/closed, no active task to save.");
            store.remove(STORAGE_KEYS.CURRENT_TASK);
        }
    };
    
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            handleSessionEnd();
        }
    });
    window.addEventListener('pagehide', handleSessionEnd);


    return () => { // Cleanup script and listeners
       const partyScript = document.querySelector('script[src="https://cdn.jsdelivr.net/npm/party-js@latest/bundle/party.min.js"]');
       if (partyScript) document.body.removeChild(partyScript);
       document.removeEventListener('visibilitychange', handleSessionEnd);
       window.removeEventListener('pagehide', handleSessionEnd);
    };
  }, []); // Run only once on mount
    
  // Refs to keep track of latest task state for session end handler
  const taskRef = useRef(task);
  const taskItemsRef = useRef(taskItems);
  useEffect(() => { taskRef.current = task; }, [task]);
  useEffect(() => { taskItemsRef.current = taskItems; }, [taskItems]);


  useEffect(() => { // Daily Reset Interval (for streak primarily now)
    const i=setInterval(()=>{
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        // Reset Daily Stats if day changed (redundant check, but safe)
        if(lastDate !== today) {
            setDailyDone(false);
            setDailyStats(DEFAULT_DAILY_STATS);
            store.set(STORAGE_KEYS.DAILY_STATS,DEFAULT_DAILY_STATS);
            setLastDate(today); // Update lastDate state as well
            store.set(STORAGE_KEYS.LAST_DATE, today); // Persist update
        }

        // Reset Streak if needed
        const lastStreakDay = store.get(STORAGE_KEYS.LAST_STREAK_DATE);
        if (lastStreakDay && lastStreakDay !== today && lastStreakDay !== yesterday) {
            console.log("Streak reset due to missed day.");
            setStreak(0);
            store.set(STORAGE_KEYS.STREAK, 0);
            // We keep LAST_STREAK_DATE to show the "Streak Lost" message until a new one starts
        }
    }, 60000); // Check every minute
    return ()=>clearInterval(i);
  }, [lastDate]); // Depend on lastDate

  // --- Helpers ---
  const showConfirm=(t,m,c)=>setModal({type:'confirm',title:t,message:m,onConfirm:c});
  const showAlert=(t,m)=>setModal({type:'alert',title:t,message:m}); // Added showAlert helper
  
  // Modified getPromptText to use INTERNAL_PLACEHOLDER internally
  const getPromptTextInternal=(p)=>(p.rawText||p.text);
  // Function to display prompt text with user's placeholder
  const getPromptTextForDisplay=(p,h=settings.placeholder)=>getPromptTextInternal(p).replace(new RegExp(INTERNAL_PLACEHOLDER,'g'),h);
  
  const isToday=d=>new Date(d).toDateString()===new Date().toDateString();
  const createItem=(p,t)=>{const ts=new Date().toISOString();return{id:Date.now()+Math.random(),text:t.trim(),...(p==='prompts'&&{rawText:t.trim().replace(new RegExp(settings.placeholder,'g'),INTERNAL_PLACEHOLDER)}),created:ts,modified:ts,starred:false}};
  const toggleNotif=async()=>{if(!settings.notificationsEnabled){if('Notification'in window){const p=await Notification.requestPermission();if(p==='granted'){setSettings(pr=>({...pr,notificationsEnabled:true}));store.set(STORAGE_KEYS.LAST_NOTIF,Date.now())}}else{alert("Notifications not supported.")}}else{setSettings(pr=>({...pr,notificationsEnabled:false}))}};

  const handleSaveManualItem = () => {
    const { pile, text } = manualAddItem;
    if (!pile || !text.trim()) {
      setManualAddItem({ show: false, pile: null, text: '' });
      return;
    }
    const trimmedText = text.trim();

    if (pile === 'prompts' && !trimmedText.includes(settings.placeholder)) {
        return setModal({ type: 'alert', title: 'Missing Placeholder', message: `Prompts must include your placeholder: "${settings.placeholder}"` });
    }

    const isDuplicate = data[pile].some(item => item.text.toLowerCase() === trimmedText.toLowerCase());
    if (isDuplicate) {
        return setModal({ type: 'alert', title: 'Duplicate Item', message: 'This item already exists.' });
    }

    setData(prev => ({ ...prev, [pile]: [...prev[pile], createItem(pile, trimmedText)] }));
    setManualAddItem({ show: false, pile: null, text: '' });
  };

  // --- Data Management Functions ---
  const backupData = () => {
    const backup = {
      data: data,
      settings: settings,
      streak: streak,
      lastStreakDate: store.get(STORAGE_KEYS.LAST_STREAK_DATE),
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-ideas-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert("Backup Successful", "Your data has been downloaded.");
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.data && imported.settings) {
          if (typeof imported.data.concepts === 'object' && typeof imported.settings.placeholder === 'string') {
            showConfirm("Confirm Import", "Importing will overwrite your current data. Are you sure?", () => {
                setData(imported.data);
                setSettings(imported.settings);
                setStreak(imported.streak || 0);
                store.set(STORAGE_KEYS.STREAK, imported.streak || 0);
                store.set(STORAGE_KEYS.LAST_STREAK_DATE, imported.lastStreakDate || null);
                store.remove(STORAGE_KEYS.CURRENT_TASK);
                store.remove(STORAGE_KEYS.DAILY_STATS);
                store.remove(STORAGE_KEYS.LAST_DATE);
                showAlert("Import Successful", "Data imported successfully. The app will now reload.");
                setTimeout(() => window.location.reload(), 1500); 
            });
          } else { throw new Error("Invalid backup file structure."); }
        } else { throw new Error("Missing 'data' or 'settings' in backup file."); }
      } catch (error) {
        console.error("Import failed:", error);
        showAlert("Import Failed", `Could not import backup: ${error.message}`);
      } finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.onerror = () => { showAlert("Import Failed", "Could not read the selected file."); if (fileInputRef.current) fileInputRef.current.value = ""; };
    reader.readAsText(file);
  };

  const resetData = () => {
      showConfirm("Reset All Data?", "This is permanent and cannot be undone. Are you absolutely sure?", () => {
        Object.values(STORAGE_KEYS).forEach(key => store.remove(key));
        setData(INITIAL_DATA); setSettings(DEFAULT_SETTINGS); setStreak(0);
        setTask(null); setTaskItems([]); setDailyDone(false);
        setDailyStats(DEFAULT_DAILY_STATS); setLastDate(new Date().toDateString()); 
        showAlert("Data Reset", "All your data has been reset. The app will now reload.");
        setTimeout(() => window.location.reload(), 1500); 
      });
  };

  // --- Task Engine ---
  // ... (generateTask remains the same) ...
  const generateTask = useCallback(() => {
    const parseTemplate = (text, pile) => {
      const inputs = {};
      const placeholders = text.match(/<(\w+)>/g) || [];
      placeholders.forEach(p => {
        const key = p.slice(1, -1);
        if (key !== 'random_word' && key !== 'latest_item') {
          inputs[key] = (inputs[key] || 0) + 1;
        }
      });
      return { text, pile, inputs, referencesLatest: /<latest_item>/.test(text) };
    };

    const possibleTasks = { concepts: [], prompts: [], ideas: [] };

    Object.entries(TASKS).forEach(([pile, templates]) => {
      templates.forEach(text => {
        const t = parseTemplate(text, pile);
        const isPossible = Object.entries(t.inputs).every(([inputPile, count]) => {
          const pileName = `${inputPile}s`;
          if (inputPile === 'prompt') {
            // Ensure there are enough concepts for *at least one* suitable prompt
            return data.prompts.some(p => (getPromptTextInternal(p).match(new RegExp(INTERNAL_PLACEHOLDER, 'gi')) || []).length <= data.concepts.length);
          }
          // Ensure enough items exist in the required pile
          return data[pileName] && data[pileName].length >= count;
        });
        if (isPossible) possibleTasks[pile].push(t);
      });
    });

    const availableCats = Object.keys(possibleTasks).filter(cat => possibleTasks[cat].length > 0);
    if (availableCats.length === 0) {
      // Fallback if no tasks are possible (e.g., no concepts/prompts/ideas exist yet)
      const fallbackTemplate = parseTemplate(TASKS.concepts[0], "concepts"); // Default to "Write N concepts"
      const [min, max] = settings.taskRanges.concepts;
      fallbackTemplate.count = Math.floor(Math.random() * (max - min + 1)) + min;
      fallbackTemplate.selections = {}; // No selections needed
      return fallbackTemplate;
    }
    
    // Choose a random category from the available ones
    const category = availableCats[Math.floor(Math.random() * availableCats.length)];
    // Choose a random template from that category
    const template = possibleTasks[category][Math.floor(Math.random() * possibleTasks[category].length)];

    // Determine the number of items for the task
    const [min, max] = settings.taskRanges[template.pile];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Prepare selections based on the template's inputs
    const selections = { concepts: [], prompts: [], ideas: [] };
    let conceptsToUse = [...data.concepts].sort(() => 0.5 - Math.random()); // Shuffle concepts

    // Handle prompt selection specifically to ensure enough concepts
    if (template.inputs.prompt) {
      // Filter prompts that require more concepts than available *overall*
      const availablePrompts = data.prompts.filter(p => (getPromptTextInternal(p).match(new RegExp(INTERNAL_PLACEHOLDER, 'gi')) || []).length <= conceptsToUse.length);
      
      // If no suitable prompts found after filtering, this task shouldn't have been selected (theoretically), 
      // but handle defensively - maybe regenerate or fallback? For now, we assume one was found.
      const selectedPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
      selections.prompts.push(selectedPrompt);
      
      // Reserve concepts needed specifically for this prompt
      const conceptsForPromptCount = (getPromptTextInternal(selectedPrompt).match(new RegExp(INTERNAL_PLACEHOLDER, 'gi')) || []).length;
      if (conceptsForPromptCount > 0) {
        selections.concepts.push(...conceptsToUse.splice(0, conceptsForPromptCount));
      }
    }
    // Select remaining concepts if needed by the template (e.g., <concept> AND <concept>)
    if (template.inputs.concept) {
       selections.concepts.push(...conceptsToUse.splice(0, template.inputs.concept));
    }
    // Select ideas if needed
    if (template.inputs.idea) {
       selections.ideas.push(...[...data.ideas].sort(() => 0.5 - Math.random()).slice(0, template.inputs.idea));
    }
    // Select a random word if needed
    if (template.text.includes('<random_word>')) {
       selections.randomWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    }
    
    return { ...template, count, selections };
  }, [data, settings]); // Dependencies


  const startTask = useCallback((isDaily = false) => {
    const newTask = generateTask();
    setTask({ ...newTask, isDaily });
    setTaskItems([]); setTaskInput(''); setView('task');
  }, [generateTask]);


  const completeTask = () => {
    if (taskItems.length === 0) return setTask(null);

    if (window.party) {
        window.party.confetti(document.body, {
            count: window.party.variation.range(40, 60),
        });
    }

    const newItems = taskItems.map(item => createItem(task.pile, item.text));
    setData(prev => ({ ...prev, [task.pile]: [...prev[task.pile], ...newItems] }));
    const newStats = { ...dailyStats, [task.pile]: dailyStats[task.pile] + newItems.length, tasks: dailyStats.tasks + 1 };
    setDailyStats(newStats); store.set(STORAGE_KEYS.DAILY_STATS, newStats);

    if (task.isDaily) {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastStreakDay = store.get(STORAGE_KEYS.LAST_STREAK_DATE);

        let newStreak = 1;
        if (lastStreakDay === yesterday) {
            newStreak = streak + 1;
        } else if (lastStreakDay === today) {
            newStreak = streak; // Don't increment if already done today
        }
        
        setStreak(newStreak);
        store.set(STORAGE_KEYS.STREAK, newStreak);
        store.set(STORAGE_KEYS.LAST_STREAK_DATE, today);

        setDailyDone(true);
        setLastDate(today);
        store.set(STORAGE_KEYS.LAST_DATE, today);
    }
    setTask(null); setView('home');
  };

  // --- Item Management ---
  const getSortedItems = (items) => { const s=[...items]; switch(sortBy){case'oldest':return s.sort((a,b)=>new Date(a.created)-new Date(b.created));case'modified':return s.sort((a,b)=>new Date(b.modified)-new Date(a.modified));case'newest':default:return s.sort((a,b)=>new Date(b.created)-new Date(a.created))}};

  // --- View Renderer ---
  const renderView = () => {
    if(view==='task' && task) {
        return <TaskView 
            task={task} 
            taskItems={taskItems} 
            settings={settings} 
            data={data}
            taskInput={taskInput}
            setTaskInput={setTaskInput}
            setTaskItems={setTaskItems}
            setView={setView}
            showConfirm={showConfirm}
            setModal={setModal} // Pass setModal for inline errors
            startTask={startTask}
            completeTask={completeTask}
        />;
    }
    if(view==='settings') {
        return <SettingsView 
            settings={settings} 
            setSettings={setSettings} 
            toggleNotif={toggleNotif} 
            setView={setView} 
            backupData={backupData}
            triggerImport={triggerImport}
            resetData={resetData}
        />;
    }
    if(['concepts','prompts','ideas','starred'].includes(view)){
      const i=view==='starred';
      const p=i?'ideas':view;
      const t=i?data.ideas.filter(i=>i.starred):data[p];
      return(<div className="p-6 max-w-3xl mx-auto"><button onClick={()=>setView('home')} className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-1 text-base font-medium">← Back to Home</button>
        <PileManager 
            pile={p} 
            items={t} 
            view={view}
            sortBy={sortBy}
            setSortBy={setSortBy}
            setManualAddItem={setManualAddItem}
            editing={editing}
            setEditing={setEditing}
            setData={setData}
            showConfirm={showConfirm}
            getPromptTextForDisplay={getPromptTextForDisplay} // Pass display version
            settings={settings}
            isToday={isToday}
        />
      </div>)
    }
    return <HomeView 
        data={data} 
        dailyStats={dailyStats} 
        setView={setView} 
        dailyDone={dailyDone}
        startTask={startTask}
        streak={streak}
        getPromptTextForDisplay={getPromptTextForDisplay} // Pass display version
    />;
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImport} 
        accept=".json" 
        style={{ display: 'none' }} 
      />
      {modal && <Modal {...modal} onCancel={() => setModal(null)} onConfirm={() => { if(modal.onConfirm) modal.onConfirm(); setModal(null); }} />}
      {/* Settings Modal is replaced by SettingsView */}
      {manualAddItem.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setManualAddItem({show: false, pile: null, text: ''})}>
            <div className="bg-white p-6 rounded-xl max-w-lg w-full m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-serif mb-4">Add new {manualAddItem.pile?.slice(0, -1)}</h2>
                {manualAddItem.pile === 'prompts' && (
                    <p className='text-sm text-zinc-500 mb-3'>Use **{settings.placeholder}** to mark where a concept should be inserted.</p>
                )}
                <textarea
                    value={manualAddItem.text}
                    onChange={(e) => setManualAddItem(prev => ({...prev, text: e.target.value}))}
                    className="w-full p-3 border rounded-lg mb-4 resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter your ${manualAddItem.pile?.slice(0, -1)} here...`}
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setManualAddItem({show: false, pile: null, text:''})}>Cancel</Button>
                    <Button onClick={handleSaveManualItem}>Save</Button>
                </div>
            </div>
        </div>
      )}
      {renderView()}
      {/* Conditionally render settings button only on home */}
      {view === 'home' && (
          <IconButton 
            onClick={() => setView('settings')} 
            title="Settings" 
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 !bg-zinc-800 !text-white hover:!bg-zinc-700 shadow-lg">
                <Settings size={20} />
          </IconButton>
      )}
      <style>{`
        .progress-bar-container {
            height: 0.75rem; /* h-3 */
            background-color: #e5e7eb; /* bg-zinc-200 */
            border-radius: 9999px;
            overflow: hidden;
            margin-bottom: 1.25rem; /* mb-5 */
        }
        .progress-bar-fill {
            height: 100%;
            transition: width 0.5s ease;
            position: relative;
            overflow: hidden;
        }
        .progress-bar-fill::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: linear-gradient(
                45deg, 
                rgba(255, 255, 255, 0.15) 25%, 
                transparent 25%, 
                transparent 50%, 
                rgba(255, 255, 255, 0.15) 50%, 
                rgba(255, 255, 255, 0.15) 75%, 
                transparent 75%, 
                transparent
            );
            background-size: 40px 40px;
            animation: progress-bar-stripes 2s linear infinite;
            z-index: 1;
        }
        @keyframes progress-bar-stripes { 
            from { background-position: 40px 0; } 
            to { background-position: 0 0; } 
        }
        .marquee-container {
            overflow: hidden;
            width: 100%;
            margin-bottom: 1.5rem; /* mb-6 */
            -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
            mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
        }
        .marquee-content {
            display: flex;
            animation: scroll 60s linear infinite;
            width: fit-content;
            white-space: nowrap; /* Prevent items from wrapping */
        }
        @keyframes scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
        }
        .animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}.animate-bounce{animation:bounce 1.5s infinite}@keyframes bounce{0%,100%{transform:translateY(-5%);animation-timing-function:cubic-bezier(.8,0,1,1)}50%{transform:translateY(0);animation-timing-function:cubic-bezier(0,0,.2,1)}}
      `}</style>
    </div>
  );
};

// --- View Components (Extracted) ---
const HomeView = ({ data, dailyStats, setView, dailyDone, startTask, streak, getPromptTextForDisplay }) => { // Changed prop name
    
    const marqueeItems = useMemo(() => {
        const allItems = [
            ...data.concepts.map(item => ({ ...item, pile: 'concepts' })),
            ...data.prompts.map(item => ({ ...item, pile: 'prompts' })),
            ...data.ideas.map(item => ({ ...item, pile: 'ideas' })),
        ];
        // Only include items if there are any, otherwise return empty to avoid errors
        return allItems.length > 0 ? allItems.sort(() => 0.5 - Math.random()) : [];
    }, [data]);

    const getStreakDisplay = () => {
        if (streak > 0) {
            let nextMilestone = STREAK_MILESTONES.find(m => m > streak);
            if (!nextMilestone) {
                // If past all defined milestones, set the next one dynamically (e.g., every 500 days)
                nextMilestone = (Math.floor(streak / 500) + 1) * 500; 
            }
            const prevMilestone = [...STREAK_MILESTONES].reverse().find(m => m <= streak) || 0;
            const milestoneTotal = nextMilestone - prevMilestone;
            const milestoneProgress = streak - prevMilestone;
            const percentage = Math.max(0, Math.min(100, (milestoneProgress / milestoneTotal) * 100)); // Ensure percentage is between 0 and 100
            const daysUntilNext = nextMilestone - streak;

            const getEncouragement = () => {
                const ratio = milestoneProgress / milestoneTotal;
                if (ratio >= 1) return "Milestone achieved!"; // Should theoretically not happen with find logic, but good failsafe
                if (ratio > 0.9) return "Almost there!";
                if (ratio > 0.75) return "So close!";
                if (ratio > 0.5) return "Over halfway!";
                if (ratio > 0.25) return "Great progress!";
                return "You've got this!";
            };

            return (
                <div className="mb-6 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-amber-300 shadow-md">
                    <span className="text-4xl" style={{filter: `saturate(${1 + streak * 0.1}) drop-shadow(0 0 8px rgba(255,150,0,${Math.min(1, streak/10)}))`, transform: `scale(${1 + streak * 0.02})`}}>🔥</span>
                    <p className="text-2xl font-bold text-amber-600 font-serif">{streak} Day Streak!</p>
                    <p className="text-sm text-zinc-500 mb-4">Keep it going by completing a daily task.</p>

                    <div className="w-full px-2">
                        <div className="relative h-2.5 w-full bg-zinc-200 rounded-full">
                            <div 
                                className="h-2.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-zinc-500 mt-1">
                            <span>{prevMilestone} days</span>
                            <span>{nextMilestone} days</span>
                        </div>
                        <p className="text-center text-sm text-zinc-600 mt-2">
                            <span className="font-bold">{getEncouragement()}</span> {daysUntilNext} day{daysUntilNext !== 1 ? 's' : ''} until your next milestone!
                        </p>
                    </div>
                </div>
            );
        }

        const lastStreakDay = store.get(STORAGE_KEYS.LAST_STREAK_DATE);
        if (lastStreakDay) {
            return (
                <div className="mb-6 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-zinc-300 shadow-sm text-center">
                    <Flame size={36} className="text-zinc-400" />
                    <p className="text-xl font-bold text-zinc-600 font-serif mt-2">Streak Lost</p>
                    <p className="text-sm text-zinc-500">You missed a day, but you can start a new streak today!</p>
                </div>
            );
        }

        return (
            <div className="mb-6 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-zinc-300 shadow-sm text-center">
                <Sparkles size={36} className="text-amber-500" />
                <p className="text-xl font-bold text-zinc-600 font-serif mt-2">Start a New Streak!</p>
                <p className="text-sm text-zinc-500">Complete a daily task to get your first flame.</p>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
          {getStreakDisplay()}
          {marqueeItems.length > 0 && <Marquee items={marqueeItems} getPromptText={getPromptTextForDisplay} />} 
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard pileKey="concepts" count={data.concepts.length} dailyCount={dailyStats.concepts} onClick={()=>setView('concepts')}/>
            <StatCard pileKey="prompts" count={data.prompts.length} dailyCount={dailyStats.prompts} onClick={()=>setView('prompts')}/>
            <StatCard pileKey="ideas" count={data.ideas.length} dailyCount={dailyStats.ideas} onClick={()=>setView('ideas')}/>
            <StatCard pileKey="starred" count={data.ideas.filter(i=>i.starred).length} dailyCount={0} onClick={()=>setView('starred')}/>
          </div>
          {dailyDone?(<Button onClick={()=>startTask(false)} className="w-full !p-6 !text-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg hover:shadow-xl transform hover:-translate-y-1"><Zap size={20}/> Start Another Task {dailyStats.tasks>0&&<span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">{dailyStats.tasks} done</span>}</Button>):(<Button onClick={()=>startTask(true)} className="w-full !p-6 !text-lg bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1"><Sparkles size={24} className="animate-pulse"/> Start Daily Task <Sparkles size={24} className="animate-pulse"/></Button>)}
        </div>
    );
};

const TaskView = ({ task, taskItems, settings, data, taskInput, setTaskInput, setTaskItems, setView, showConfirm, setModal, startTask, completeTask }) => {
    const isGoalMet = task && taskItems.length >= task.count;
    const [taskError, setTaskError] = useState(''); // State for inline error messages

    const addTaskItem = () => {
        setTaskError(''); // Clear previous error
        const trimmedInput = taskInput.trim();
        if (!trimmedInput) return;

        if (task.pile === 'prompts' && !trimmedInput.includes(settings.placeholder)) {
            setTaskError(`Prompts must include your placeholder: "${settings.placeholder}"`);
            return;
        }
        
        const isDuplicateInData = data[task.pile].some(item => item.text.toLowerCase() === trimmedInput.toLowerCase());
        const isDuplicateInTask = taskItems.some(item => item.text.toLowerCase() === trimmedInput.toLowerCase());
        if (isDuplicateInData || isDuplicateInTask) {
             setTaskError('This item already exists.');
            return;
        }

        setTaskItems(prev => [...prev, { text: trimmedInput, created: new Date().toISOString() }]); 
        setTaskInput('');
    };
    
    // Clear error when input changes
    const handleInputChange = (e) => {
        setTaskInput(e.target.value);
        if (taskError) setTaskError('');
    };
    
    const percentage = useMemo(() => Math.min(100, (taskItems.length / task.count) * 100), [taskItems.length, task.count]);

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={()=>taskItems.length>0?showConfirm('Abandon Task?','You have unsaved items. Are you sure?',()=>setView('home')):setView('home')} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-base font-medium">← Back to Home</button>
          <IconButton title="Get new random task" onClick={()=>showConfirm('Start New Task?','Your current task progress will be lost.',()=>startTask(task?.isDaily))}><Dice6 size={20}/></IconButton>
        </div>
        <TaskInstructions task={task} taskItems={taskItems} />
        <p className="text-zinc-600 mb-4 text-sm font-medium">{taskItems.length} of {task.count} completed</p>
        <AnimatedProgressBar percentage={percentage} />
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-md mb-6">
          <div className="flex gap-2 mb-2">
            <input 
                type="text" 
                value={taskInput} 
                onChange={handleInputChange} // Use handler to clear error
                onKeyPress={e=>e.key==='Enter'&&addTaskItem()} 
                placeholder={`Enter new ${task.pile.slice(0,-1)}...`} 
                className="flex-1 p-3 border border-zinc-300 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus/>
            {task.pile==='prompts'&&<button onClick={()=>setTaskInput(p=>p+settings.placeholder)} className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-mono shadow-sm">{settings.placeholder}</button>}
            <Button onClick={addTaskItem} disabled={!taskInput.trim()}><Plus size={20}/></Button>
          </div>
          {taskError && <p className="text-red-600 text-sm mt-1">{taskError}</p>} 
          {isGoalMet && <Button variant="success" onClick={completeTask} className="w-full mt-3 text-lg animate-bounce">✨ Save & Complete Task ✨</Button>}
        </div>
        <div className="space-y-3">
          {taskItems.slice().reverse().map((item,i)=>(<div key={item.created} className="bg-white p-3 rounded-lg border border-zinc-200 flex justify-between items-center shadow-sm"><span className="text-zinc-700 break-words pr-4">{item.text}</span><button onClick={()=>setTaskItems(prev=>prev.filter((_,idx)=>idx!==(prev.length-1-i)))} className="text-red-500 hover:text-red-600 p-1" title="Remove"><X size={18}/></button></div>))}
        </div>
      </div>
    );
};
  
const PileManager=({pile,items,view,sortBy,setSortBy,setManualAddItem,editing,setEditing,setData,showConfirm,getPromptTextForDisplay,settings,isToday})=>{ // Changed prop name
    const config=PILE_CONFIG[pile==='ideas'&&view==='starred'?'starred':pile];
    const showStar=pile==='ideas';
    const saveEdit=()=>{
        if(!editing||!editing.text.trim())return setEditing(null);
        const{item,text}=editing;
        const modifiedItem={...item,text:text.trim(),modified:new Date().toISOString()};
        // Use createItem logic to handle placeholder conversion correctly
        if(pile==='prompts') {
            const tempItem = createItem('prompts', text.trim());
            modifiedItem.rawText = tempItem.rawText;
        }
        setData(prev=>({...prev,[pile]:prev[pile].map(i=>i.id===item.id?modifiedItem:i)}));
        setEditing(null)
    };
    const exportPile=()=>{const text=items.map(i=>pile==='prompts'?getPromptTextForDisplay(i):i.text).join('\n');const blob=new Blob([text],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${config.name.replace(' ','-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)};
    
    // Helper to render placeholder visually in PileManager list
    const renderPromptWithPlaceholder = (item) => {
        const text = item.rawText || item.text; // Use rawText for internal placeholder
        const parts = text.split(INTERNAL_PLACEHOLDER);
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && <DashedPlaceholder />} 
            </React.Fragment>
        ));
    };

    return(
    <div className="p-4">
        {/* Responsive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 border-b pb-3 border-zinc-200 gap-2">
            <h2 className="text-xl sm:text-2xl font-serif text-zinc-800 flex items-center gap-2"><config.icon size={24} className={config.classes.text}/> {config.name} ({items.length})</h2>
            <div className="flex gap-2 items-center justify-end w-full sm:w-auto">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="p-2 border border-zinc-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500 flex-grow sm:flex-grow-0">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="modified">Modified</option>
                </select>
                {view!=='starred'&&<Button onClick={()=>setManualAddItem({show:true,pile,text:''})} className="!px-2 sm:!px-4"><Plus size={18}/></Button>}
                <Button variant="success" onClick={exportPile} className="!px-2 sm:!px-4"><Download size={18}/></Button>
            </div>
        </div>
        <div className="space-y-4">
            {items.sort((a,b)=>{if(sortBy==='oldest')return new Date(a.created)-new Date(b.created);if(sortBy==='modified')return new Date(b.modified)-new Date(a.modified);return new Date(b.created)-new Date(a.created)}).map(item=>(
                <div key={item.id} className={`bg-white p-4 rounded-lg border shadow-sm ${isToday(item.created)?'border-amber-400 bg-amber-50/30':'border-zinc-200'}`}>
                    {editing?.item.id===item.id?(
                        <div className="flex flex-col gap-2">
                             {/* Edit input: Convert internal placeholder back to user's placeholder */}
                            <input type="text" value={editing.text} onChange={e=>setEditing({...editing,text:e.target.value})} onKeyPress={e=>e.key==='Enter'&&saveEdit()} className="flex-1 p-3 border border-zinc-300 rounded-lg" autoFocus/>
                            <div className='flex justify-end gap-2'>
                                <Button variant="success" onClick={saveEdit}><Check size={18}/> Save</Button>
                                <Button variant="secondary" onClick={()=>setEditing(null)}><X size={18}/> Cancel</Button>
                            </div>
                        </div>
                    ):(<>
                        <div className="flex justify-between items-start mb-2">
                            {/* Display logic: Use renderPromptWithPlaceholder for prompts */}
                            <p className="flex-1 text-zinc-700 break-words pr-4">
                                {pile === 'prompts' ? renderPromptWithPlaceholder(item) : item.text}
                            </p>
                            {/* Responsive Buttons */}
                            <div className="flex gap-2 sm:gap-1 flex-shrink-0">
                                {showStar&&<button onClick={()=>setData(p=>({...p,ideas:p.ideas.map(i=>i.id===item.id?{...i,starred:!i.starred,modified:new Date().toISOString()}:i)}))} className={`${item.starred?'text-amber-500':'text-zinc-300 hover:text-amber-400'} p-2 sm:p-1`}><Star size={18} fill={item.starred?'currentColor':'none'}/></button>}
                                {/* Edit button: Convert internal to user's placeholder for editing */}
                                <button onClick={()=>setEditing({item,text:pile==='prompts'?getPromptTextForDisplay(item,settings.placeholder):item.text})} className="text-blue-500 hover:text-blue-600 p-2 sm:p-1"><Edit2 size={18}/></button>
                                <button onClick={()=>showConfirm('Delete Item?','This is permanent.',()=>setData(prev=>({...prev,[pile]:prev[pile].filter(i=>i.id!==item.id)})))} className="text-red-500 hover:text-red-600 p-2 sm:p-1"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500">Created: {new Date(item.created).toLocaleString()}</p>
                    </>)}
                </div>
            ))}
            {items.length===0&&<p className="text-zinc-500 text-center py-12 font-serif italic">No {config.name.toLowerCase()} yet.</p>}
        </div>
    </div>
    )
};
  
const SettingsView=({setView, settings,setSettings,toggleNotif, backupData, triggerImport, resetData})=>{
    const handleRangeChange=(pile,index,value)=>{
        const newRanges={...settings.taskRanges};
        const currentRange=newRanges[pile];
        const numValue=parseInt(value)||1;
        if(index===0){currentRange[0]=Math.max(1,Math.min(numValue,currentRange[1]))}
        else{currentRange[1]=Math.min(20,Math.max(numValue,currentRange[0]))}
        setSettings(prev=>({...prev,taskRanges:newRanges}))
    };
    return(
    <div className="p-6 max-w-xl mx-auto">
        <button onClick={()=>setView('home')} className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-1 text-base font-medium">← Back to Home</button>
        <div className="bg-white p-6 rounded-xl shadow-md border border-zinc-200">
            <h2 className="text-2xl font-serif mb-6 border-b pb-3">App Settings</h2>
            {/* General Settings */}
            <div className="mb-4 bg-zinc-50 p-3 rounded-lg border">
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={settings.notificationsEnabled} onChange={toggleNotif} className="w-5 h-5 text-blue-600 rounded-md focus:ring-blue-500"/><span className='text-zinc-700'>Enable Notifications</span></label>
                <p className="text-xs text-zinc-500 mt-1 pl-8">Reminds you every 2 hours.</p>
            </div>
            <div className="mb-4 bg-zinc-50 p-3 rounded-lg border">
                <label className="block mb-2 text-sm font-medium text-zinc-700">Prompt Placeholder Text</label>
                <input type="text" value={settings.placeholder} onChange={e=>setSettings(prev=>({...prev,placeholder:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)}))} className="w-full p-2 border rounded-lg font-mono text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-500" maxLength={5}/>
                <p className="text-xs text-zinc-500 mt-1">Max 5 chars, alphanumeric. Used when typing prompts.</p>
            </div>
            <div className="mb-4 bg-zinc-50 p-3 rounded-lg border">
                <label className="block mb-2 text-sm font-medium text-zinc-700">Daily Task Ranges (Min - Max)</label>
                {Object.keys(settings.taskRanges).map(pile=>(
                    <div key={pile} className="flex items-center gap-2 mb-2">
                        <span className="w-20 text-sm capitalize text-zinc-600">{pile}:</span>
                        <input type="number" min="1" max="20" value={settings.taskRanges[pile][0]} onChange={e=>handleRangeChange(pile,0,e.target.value)} className="w-16 p-1 border rounded-md text-sm text-center"/>
                        <span>to</span>
                        <input type="number" min="1" max="20" value={settings.taskRanges[pile][1]} onChange={e=>handleRangeChange(pile,1,e.target.value)} className="w-16 p-1 border rounded-md text-sm text-center"/>
                    </div>
                ))}
            </div>
            {/* Data Management Section */}
            <div className="mt-6 pt-4 border-t">
                 <h3 className="text-lg font-medium text-zinc-700 mb-3">Data Management</h3>
                 <div className="grid grid-cols-2 gap-3">
                     <Button variant="secondary" onClick={backupData}><Download size={16} /> Backup Data</Button>
                     <Button variant="secondary" onClick={triggerImport}><Upload size={16} /> Import Backup</Button>
                 </div>
                 <div className="mt-4">
                     <Button variant="danger" className="w-full" onClick={resetData}><RotateCcw size={16} /> Reset All Data</Button>
                     <p className="text-xs text-zinc-500 mt-1 text-center">Warning: This will permanently delete everything.</p>
                 </div>
            </div>
             {/* Version Info */}
             <p className="text-center text-xs text-zinc-400 mt-6">Version: {APP_VERSION}</p>
        </div>
    </div>
    )
};

const TaskInstructions = React.memo(({ task, taskItems }) => {
    const KeywordText = ({ text }) => {
        const keywords = ['concepts', 'prompts', 'ideas'];
        const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
        const parts = text.split(regex).filter(Boolean);
        return <>{parts.map((part, i) => {
            const lowerPart = part.toLowerCase();
            if (keywords.includes(lowerPart)) {
                return <span key={i} className={`${PILE_CONFIG[lowerPart].classes.text} font-bold`}>{part}</span>;
            }
            return <span key={i}>{part}</span>;
        })}</>;
    };

    const StyledItem = ({ item, pile }) => {
        const config = PILE_CONFIG[pile] || { classes: { bg: 'bg-zinc-100', borderInner: 'border-zinc-300' } };
        return <span className={`inline-block align-middle ${config.classes.bg} border ${config.classes.borderInner} px-2 py-1 rounded text-lg mx-1`}>{item.text}</span>;
    };

    const StyledPrompt = ({ prompt, concepts }) => {
        const promptText = getPromptTextInternal(prompt); // Use internal representation
        const parts = promptText.split(INTERNAL_PLACEHOLDER);
        let conceptIndex = 0;
        return (
            <span className={`inline-block align-middle ${PILE_CONFIG.prompts.classes.bg} border ${PILE_CONFIG.prompts.classes.borderInner} px-2 py-1 rounded text-lg mx-1`}>
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part}
                        {i < parts.length - 1 && conceptIndex < concepts.length && (
                            <StyledItem item={concepts[conceptIndex++]} pile="concepts" />
                        )}
                        {/* Render placeholder visually if not enough concepts (edge case) */}
                        {i < parts.length - 1 && conceptIndex >= concepts.length && <DashedPlaceholder />}
                    </React.Fragment>
                ))}
            </span>
        );
    };

    let instruction = task.text.replace('{N}', task.count);
    const placeholderRegex = /(<concept>|<idea>|<prompt>|<random_word>|<latest_item>)/g;
    const parts = instruction.split(placeholderRegex).filter(Boolean);
    const itemQueues = {
        concept: [...(task.selections.concepts || [])],
        idea: [...(task.selections.ideas || [])],
        prompt: [...(task.selections.prompts || [])],
    };
    const PileIcon = PILE_CONFIG[task.pile].icon;

    return (
        <div className="flex items-start gap-3">
          <PileIcon size={28} className={`${PILE_CONFIG[task.pile].classes.text} mt-1 flex-shrink-0`} />
          <h2 className="text-2xl font-serif text-zinc-800 mb-2">
              <span className='leading-relaxed'>
                  {parts.map((part, i) => {
                      if (part === '<concept>') return <StyledItem key={i} item={itemQueues.concept.shift()} pile="concepts" />;
                      if (part === '<idea>') return <StyledItem key={i} item={itemQueues.idea.shift()} pile="ideas" />;
                      if (part === '<prompt>') {
                          const prompt = itemQueues.prompt.shift();
                          const conceptsForPromptCount = (getPromptTextInternal(prompt).match(new RegExp(INTERNAL_PLACEHOLDER, 'gi')) || []).length;
                          // Use the concepts specifically selected for this task, if available
                          const concepts = task.selections?.concepts?.slice(0, conceptsForPromptCount) || [];
                          return <StyledPrompt key={i} prompt={prompt} concepts={concepts} />;
                      }
                      if (part === '<random_word>') return <StyledItem key={i} item={{ text: task.selections.randomWord }} pile="random" />;
                      if (part === '<latest_item>') {
                          return taskItems.length > 0
                              ? <StyledItem key={i} item={taskItems[taskItems.length - 1]} pile={task.pile} />
                              : <span key={i}>(write something first)</span>;
                      }
                      return <KeywordText key={i} text={part} />;
                  })}
              </span>
          </h2>
        </div>
    );
});

export default VideoIdeasApp;

