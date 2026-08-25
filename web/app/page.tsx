'use client';

import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

type View = 'dashboard' | 'ideas' | 'notes' | 'tags' | 'shots';
type Idea = { id: string; text: string; tag: string; created: string };
type Note = { id: string; title: string; body: string; tag: string; color: string };
type Task = { id: string; text: string; done: boolean };
type Shot = { id: string; name: string; src: string };
type Store = { ideas: Idea[]; notes: Note[]; tags: string[]; tasks: Task[]; shots: Shot[]; accent: string };

const nav: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: '首页仪表盘' },
  { id: 'ideas', icon: '💡', label: '灵感速记' },
  { id: 'notes', icon: '📝', label: '便利贴' },
  { id: 'tags', icon: '🏷️', label: '分类标签' },
  { id: 'shots', icon: '📸', label: '截图贴图' },
];

const initial: Store = {
  ideas: [
    { id: 'i1', text: '比较三种实验设置下模型的收敛速度', tag: '实验', created: '今天 09:30' },
    { id: 'i2', text: '补充讨论部分：解释异常样本的来源', tag: '论文', created: '昨天 21:18' },
  ],
  notes: [
    { id: 'n1', title: '本周研究重点', body: '完成消融实验\n整理图 3 的数据\n约导师讨论结果', tag: '实验', color: '#fff1c9' },
    { id: 'n2', title: '论文修改', body: '引言需要更明确地说明研究缺口。', tag: '论文', color: '#ffe1ec' },
  ],
  tags: ['论文', '实验', '阅读', '待办'],
  tasks: [
    { id: 't1', text: '整理今日实验记录', done: false },
    { id: 't2', text: '精读一篇相关论文', done: false },
    { id: 't3', text: '备份研究数据', done: true },
  ],
  shots: [],
  accent: '#ec2464',
};

const uid = () => Math.random().toString(36).slice(2, 10);
const API_BASE = 'http://127.0.0.1:8766';

export default function Home() {
  const [view, setView] = useState<View>('dashboard');
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [ideaTag, setIdeaTag] = useState('论文');
  const [tagText, setTagText] = useState('');
  const [lightbox, setLightbox] = useState<Shot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/data`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((saved) => setStore({ ...initial, ...saved }))
      .catch(() => setStore(initial))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      fetch(`${API_BASE}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [store, ready]);

  const done = store.tasks.filter((task) => task.done).length;
  const progress = Math.round((done / Math.max(store.tasks.length, 1)) * 100);
  const title = nav.find((item) => item.id === view)?.label ?? '首页仪表盘';
  const style = { '--accent': store.accent } as CSSProperties;

  function addIdea() {
    const text = ideaText.trim();
    if (!text) return;
    setStore((current) => ({
      ...current,
      ideas: [{ id: uid(), text, tag: ideaTag || '未分类', created: '刚刚' }, ...current.ideas],
    }));
    setIdeaText('');
  }

  function addNote() {
    setStore((current) => ({
      ...current,
      notes: [{ id: uid(), title: '新便利贴', body: '', tag: current.tags[0] ?? '未分类', color: '#fff1c9' }, ...current.notes],
    }));
  }

  function addTag() {
    const tag = tagText.trim();
    if (!tag || store.tags.includes(tag)) return;
    setStore((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagText('');
  }

  function removeTag(tag: string) {
    setStore((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
      ideas: current.ideas.map((item) => item.tag === tag ? { ...item, tag: '未分类' } : item),
      notes: current.notes.map((item) => item.tag === tag ? { ...item, tag: '未分类' } : item),
    }));
  }

  async function saveImage(name: string, src: string) {
    const response = await fetch(`${API_BASE}/api/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, src }),
    });
    if (!response.ok) throw new Error('图片保存失败');
    return response.json() as Promise<Shot>;
  }

  async function captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());
      const name = `屏幕截图 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
      const shot = await saveImage(name, canvas.toDataURL('image/jpeg', 0.78));
      setStore((current) => ({ ...current, shots: [shot, ...current.shots].slice(0, 12) }));
      setLightbox(shot);
    } catch {}
  }

  function importShot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const shot = await saveImage(file.name, String(reader.result));
        setStore((current) => ({ ...current, shots: [shot, ...current.shots].slice(0, 12) }));
      } catch {}
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  return (
    <div className="app-shell" style={style}>
      <aside className="sidebar">
        <div className="brand"><span>R</span><strong>科研工作台</strong></div>
        <nav>
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip"><b>所有内容自动保存</b><small>分类写入当前目录的本地文件</small></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p>Research Workbench</p><h1>{title}</h1></div>
          <div className="theme-picker" aria-label="主题色">
            {['#ec2464', '#31a8e6', '#65bd74', '#9c3db3', '#ff7149'].map((color) => (
              <button key={color} aria-label={`选择主题色 ${color}`} className={store.accent === color ? 'selected' : ''} style={{ background: color }} onClick={() => setStore((current) => ({ ...current, accent: color }))} />
            ))}
          </div>
        </header>

        {view === 'dashboard' && <Dashboard store={store} progress={progress} done={done} setStore={setStore} go={setView} />}
        {view === 'ideas' && (
          <section className="page-grid">
            <div className="card composer">
              <div className="section-heading"><div><span>💡</span><div><h2>记录灵感</h2><p>想到什么就立即写下来</p></div></div></div>
              <textarea value={ideaText} onChange={(event) => setIdeaText(event.target.value)} placeholder="记录一个新的研究想法……" />
              <div className="composer-actions">
                <select value={ideaTag} onChange={(event) => setIdeaTag(event.target.value)}>{['未分类', ...store.tags].map((tag) => <option key={tag}>{tag}</option>)}</select>
                <button className="primary" onClick={addIdea}>保存灵感</button>
              </div>
            </div>
            <div className="card list-card">
              <div className="section-heading"><div><span>📚</span><div><h2>灵感记录</h2><p>共 {store.ideas.length} 条</p></div></div></div>
              {store.ideas.map((idea) => <article className="idea-row" key={idea.id}><div><span className="tag">{idea.tag}</span><p>{idea.text}</p><small>{idea.created}</small></div><button className="icon-button" onClick={() => setStore((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== idea.id) }))}>×</button></article>)}
              {!store.ideas.length && <Empty text="还没有灵感，先记录第一条吧" />}
            </div>
          </section>
        )}

        {view === 'notes' && (
          <section>
            <div className="page-actions"><p>像纸质便签一样自由记录，修改后自动保存。</p><button className="primary" onClick={addNote}>＋ 新建便利贴</button></div>
            <div className="notes-grid">
              {store.notes.map((note) => <NoteCard key={note.id} note={note} tags={store.tags} update={(patch) => setStore((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, ...patch } : item) }))} remove={() => setStore((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== note.id) }))} />)}
            </div>
          </section>
        )}

        {view === 'tags' && (
          <section className="card tags-page">
            <div className="section-heading"><div><span>🏷️</span><div><h2>分类标签</h2><p>统一整理灵感和便利贴</p></div></div></div>
            <div className="inline-form"><input value={tagText} onChange={(event) => setTagText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTag()} placeholder="新标签名称" /><button className="primary" onClick={addTag}>添加标签</button></div>
            <div className="tag-list">{store.tags.map((tag) => <div key={tag}><span className="tag-dot" /><b>{tag}</b><small>{store.ideas.filter((item) => item.tag === tag).length} 条灵感 · {store.notes.filter((item) => item.tag === tag).length} 张便签</small><button onClick={() => removeTag(tag)}>删除</button></div>)}</div>
          </section>
        )}

        {view === 'shots' && (
          <section>
            <div className="card shot-hero"><div><span>📸</span><div><h2>截图与贴图</h2><p>捕获屏幕，或导入图片作为研究素材</p></div></div><div><button className="soft-button" onClick={() => fileRef.current?.click()}>导入图片</button><button className="primary" onClick={captureScreen}>捕获屏幕</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={importShot} /></div></div>
            <div className="shots-grid">{store.shots.map((shot) => <article key={shot.id}><button className="shot-preview" onClick={() => setLightbox(shot)}><img src={shot.src} alt={shot.name} /></button><div><span>{shot.name}</span><button onClick={() => setStore((current) => ({ ...current, shots: current.shots.filter((item) => item.id !== shot.id) }))}>×</button></div></article>)}</div>
            {!store.shots.length && <div className="card"><Empty text="暂无截图，点击上方按钮开始收集" /></div>}
          </section>
        )}
      </main>

      {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><button aria-label="关闭">×</button><img src={lightbox.src} alt={lightbox.name} /></div>}
    </div>
  );
}

function Dashboard({ store, progress, done, setStore, go }: { store: Store; progress: number; done: number; setStore: React.Dispatch<React.SetStateAction<Store>>; go: (view: View) => void }) {
  const date = useMemo(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()), []);
  return <section className="dashboard">
    <div className="welcome"><div><p>{date}</p><h2>今天也向研究目标靠近一点。</h2></div><span>完成度 <b>{progress}%</b></span></div>
    <div className="stats"><button onClick={() => go('ideas')}><span>💡</span><div><b>{store.ideas.length}</b><small>灵感记录</small></div></button><button onClick={() => go('notes')}><span>📝</span><div><b>{store.notes.length}</b><small>便利贴</small></div></button><button onClick={() => go('tags')}><span>🏷️</span><div><b>{store.tags.length}</b><small>分类标签</small></div></button><button onClick={() => go('shots')}><span>📸</span><div><b>{store.shots.length}</b><small>截图素材</small></div></button></div>
    <div className="card tasks-card"><div className="section-heading"><div><span>📋</span><div><h2>今日计划</h2><p>已完成 {done}/{store.tasks.length} 项任务</p></div></div><span className="progress-pill">{done}/{store.tasks.length}</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="task-list">{store.tasks.map((task) => <label key={task.id} className={task.done ? 'done' : ''}><input type="checkbox" checked={task.done} onChange={() => setStore((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item) }))} /><span>{task.text}</span><button onClick={(event) => { event.preventDefault(); setStore((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) })); }}>×</button></label>)}<button className="add-task" onClick={() => { const text = prompt('输入新任务'); if (text?.trim()) setStore((current) => ({ ...current, tasks: [...current.tasks, { id: uid(), text: text.trim(), done: false }] })); }}>＋ 添加新任务</button></div></div>
    <p className="motto">每天进步一点点 <small>Make a little progress every day.</small></p>
  </section>;
}

function NoteCard({ note, tags, update, remove }: { note: Note; tags: string[]; update: (patch: Partial<Note>) => void; remove: () => void }) {
  return <article className="note-card" style={{ background: note.color }}><div><input value={note.title} onChange={(event) => update({ title: event.target.value })} /><button onClick={remove}>×</button></div><textarea value={note.body} onChange={(event) => update({ body: event.target.value })} placeholder="写点什么……" /><footer><select value={note.tag} onChange={(event) => update({ tag: event.target.value })}>{['未分类', ...tags].map((tag) => <option key={tag}>{tag}</option>)}</select><div>{['#fff1c9', '#ffe1ec', '#dff5e5', '#dfeeff', '#efe3ff'].map((color) => <button key={color} aria-label="更换便签颜色" style={{ background: color }} onClick={() => update({ color })} />)}</div></footer></article>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>✦</span><p>{text}</p></div>; }
