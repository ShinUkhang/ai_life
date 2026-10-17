/* 파이썬 코딩 제출실 — 공통 엔진
 * API(구글 시트 / 데모), 파이썬 실행기, 자동 확인, 코드 에디터, 스스로 기록기, 보고서
 */
(function () {
  const CFG = window.PYCLASS_CONFIG || {};
  const TASKS = window.PYCLASS_TASKS || [];
  const PC = {};
  window.PC = PC;
  PC.cfg = CFG;
  PC.tasks = TASKS;
  PC.task = (id) => TASKS.find((t) => t.id === id);
  PC.demo = !CFG.API_URL;

  /* ---------- 작은 도구들 ---------- */
  PC.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  PC.$ = (sel, root) => (root || document).querySelector(sel);
  PC.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PC.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  PC.mins = (ms) => { const m = Math.round((ms || 0) / 60000); return m < 1 ? "1분 미만" : m + "분"; };
  PC.dt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  PC.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  PC.sha = async (text) => {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return "x" + h;
  };
  PC.pinHash = (sid, pin) => PC.sha(`${sid}:${pin}:pyclass`);
  PC.toast = (msg, kind) => {
    let box = PC.$("#pc-toast");
    if (!box) { box = document.createElement("div"); box.id = "pc-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add("out"), 2600);
    setTimeout(() => el.remove(), 3100);
  };

  /* 학생·과제별 최신 제출만 고르기 */
  PC.latest = (subs) => {
    const m = {};
    subs.forEach((s) => { const k = s.sid + "|" + s.task; if (!m[k] || m[k].at < s.at) m[k] = s; });
    return m;
  };

  /* ---------- API ---------- */
  const DEMO_KEY = "pyclass_demo_db_v1";
  const demoDB = () => PC.store.get(DEMO_KEY, { students: [], subs: [], reports: [] });
  const demoSave = (db) => PC.store.set(DEMO_KEY, db);
  const strip = (s) => { const c = Object.assign({}, s); delete c.replay; return c; };
  const DEMO = {
    login(r) {
      const db = demoDB();
      const st = db.students.find((s) => s.sid === r.sid);
      const now = new Date().toISOString();
      if (!st) { db.students.push({ sid: r.sid, name: r.name, pinHash: r.pinHash, createdAt: now, lastLogin: now }); demoSave(db); return { student: { sid: r.sid, name: r.name }, created: true }; }
      if (st.pinHash !== r.pinHash) throw new Error("비밀번호가 맞지 않아요. 기억나지 않으면 선생님께 초기화를 부탁하세요.");
      if (st.name !== r.name) throw new Error(`이 학번은 '${st.name}' 이름으로 등록되어 있어요.`);
      st.lastLogin = now; demoSave(db);
      return { student: { sid: st.sid, name: st.name } };
    },
    _auth(db, r) {
      const st = db.students.find((s) => s.sid === r.sid);
      if (!st || st.pinHash !== r.pinHash) throw new Error("로그인 정보가 맞지 않아요. 다시 로그인해 주세요.");
      return st;
    },
    submit(r) {
      const db = demoDB(); const st = this._auth(db, r);
      const sub = Object.assign({}, r.sub, { id: PC.uid(), at: new Date().toISOString(), sid: st.sid, name: st.name, status: "제출됨", rubric: null, total: null, feedback: "", gradedAt: "" });
      db.subs.push(sub); demoSave(db); return { id: sub.id, at: sub.at };
    },
    mine(r) {
      const db = demoDB(); const st = this._auth(db, r);
      return { subs: db.subs.filter((s) => s.sid === st.sid).map(strip), reports: db.reports.filter((x) => x.sid === st.sid && x.published), classStats: classStats(db.subs) };
    },
    _teacher(r) { if (r.key !== (CFG.DEMO_TEACHER_KEY || "teacher")) throw new Error("교사 비밀번호가 맞지 않아요."); },
    teacherAll(r) { this._teacher(r); const db = demoDB(); return { subs: db.subs.map(strip), students: db.students.map((s) => ({ sid: s.sid, name: s.name, createdAt: s.createdAt, lastLogin: s.lastLogin })), reports: db.reports }; },
    teacherGet(r) { this._teacher(r); const s = demoDB().subs.find((x) => x.id === r.id); if (!s) throw new Error("제출물을 찾지 못했어요."); return { sub: s }; },
    grade(r) {
      this._teacher(r); const db = demoDB(); const s = db.subs.find((x) => x.id === r.id);
      if (!s) throw new Error("제출물을 찾지 못했어요.");
      Object.assign(s, { rubric: r.rubric, total: r.total, feedback: r.feedback, status: r.status, gradedAt: new Date().toISOString() });
      demoSave(db); return { sub: strip(s) };
    },
    saveReport(r) {
      this._teacher(r); const db = demoDB(); const key = r.sid + "|" + r.range;
      let rep = db.reports.find((x) => x.key === key);
      if (!rep) { rep = { key, sid: r.sid, range: r.range }; db.reports.push(rep); }
      Object.assign(rep, { comment: r.comment, published: !!r.published, updatedAt: new Date().toISOString() });
      demoSave(db); return { report: rep };
    },
    resetPin(r) { this._teacher(r); const db = demoDB(); db.students = db.students.filter((s) => s.sid !== r.sid); demoSave(db); return {}; }
  };
  PC.demoDB = demoDB; PC.demoSave = demoSave;

  function classStats(subs) {
    const latest = Object.values(PC.latest(subs));
    const by = {};
    latest.forEach((s) => { if (s.total == null || s.total === "") return; (by[s.task] = by[s.task] || []).push(Number(s.total)); });
    const avg = {};
    Object.keys(by).forEach((k) => { avg[k] = by[k].reduce((a, b) => a + b, 0) / by[k].length; });
    return { taskAvg: avg };
  }
  PC.classStats = classStats;

  PC.api = async (action, payload) => {
    if (PC.demo) {
      await new Promise((r) => setTimeout(r, 150));
      if (!DEMO[action]) throw new Error("알 수 없는 요청: " + action);
      return DEMO[action](Object.assign({}, payload));
    }
    let res;
    try {
      res = await fetch(CFG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ action }, payload)) });
    } catch (e) { throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요."); }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error("서버 응답을 읽지 못했어요. Apps Script 배포 설정(액세스: 모든 사용자)을 확인하세요."); }
    if (!j.ok) throw new Error(j.error || "요청을 처리하지 못했어요.");
    return j;
  };

  /* ---------- 파이썬 실행기 (Web Worker + Pyodide) ---------- */
  const PYODIDE = CFG.PYODIDE_URL || "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const WORKER_SRC = `
importScripts("${PYODIDE}pyodide.js");
const BOOT = ${JSON.stringify(`
import io, sys, traceback
def __run__(user_code, stdin_text):
    out = io.StringIO()
    lines = iter(stdin_text.splitlines())
    def _input(prompt=""):
        out.write(str(prompt))
        try:
            v = next(lines)
        except StopIteration:
            raise EOFError("__NEED_INPUT__")
        out.write(v + "\\n")
        return v
    ns = {"__name__": "__main__", "input": _input}
    etype = emsg = ""
    eline = 0
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        exec(compile(user_code, "<코드>", "exec"), ns)
    except BaseException as e:
        etype = type(e).__name__
        emsg = str(e)
        if isinstance(e, SyntaxError) and e.lineno:
            eline = e.lineno
        else:
            fr = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<코드>"]
            eline = fr[-1].lineno if fr else 0
    finally:
        sys.stdout, sys.stderr = old
    text = out.getvalue()
    if len(text) > 20000:
        text = text[:20000] + "\\n... (출력이 너무 길어 잘랐어요)"
    return [text, etype, emsg, eline]
`)};
let py;
const ready = loadPyodide({ indexURL: "${PYODIDE}" }).then(async (p) => { py = p; await py.runPythonAsync(BOOT); postMessage({ ready: true }); }).catch((e) => postMessage({ fail: String(e) }));
onmessage = async (e) => {
  await ready;
  const { id, code, stdin } = e.data;
  try {
    py.globals.set("__c", code); py.globals.set("__s", stdin || "");
    const r = py.runPython("__run__(__c, __s)").toJs();
    postMessage({ id, out: r[0], etype: r[1], emsg: r[2], eline: r[3] });
  } catch (err) { postMessage({ id, out: "", etype: "실행기 오류", emsg: String(err), eline: 0 }); }
};`;
  let worker = null, wReady = null, pending = {}, onStatus = () => {};
  PC.onRunnerStatus = (fn) => { onStatus = fn; };
  function boot() {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(url);
    onStatus("loading");
    wReady = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const d = e.data;
        if (d.ready) { onStatus("ready"); resolve(); return; }
        if (d.fail) { onStatus("fail", d.fail); reject(new Error(d.fail)); return; }
        const p = pending[d.id]; if (p) { delete pending[d.id]; p(d); }
      };
      worker.onerror = (e) => { onStatus("fail", e.message); reject(e); };
    });
    return wReady;
  }
  PC.bootRunner = () => wReady || boot();
  PC.run = async (code, stdin, timeoutMs) => {
    if (!worker) boot();
    await wReady;
    const id = PC.uid();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        delete pending[id];
        worker.terminate(); worker = null; wReady = null; boot();
        resolve({ out: "", etype: "시간 초과", emsg: "", eline: 0, timeout: true });
      }, timeoutMs || 6000);
      pending[id] = (d) => { clearTimeout(timer); resolve(d); };
      worker.postMessage({ id, code, stdin: stdin || "" });
    });
  };

  const ERR_TIPS = {
    SyntaxError: "문법 오류예요. 괄호·따옴표 짝, 줄 끝의 콜론(:)을 확인해요.",
    IndentationError: "들여쓰기 오류예요. if·for·def 다음 줄은 4칸(Tab) 들여써요.",
    TabError: "Tab과 스페이스가 섞였어요. 들여쓰기를 한 가지로 맞춰요.",
    NameError: "이름 오류예요. 변수·함수 이름의 철자를 확인하고, 쓰기 전에 먼저 만들었는지 봐요.",
    TypeError: "자료형 오류예요. 문자열과 숫자를 바로 계산했는지 확인해요. input()의 결과는 문자열이에요.",
    ValueError: "값 오류예요. int()나 float()에 숫자가 아닌 글자가 들어갔는지 확인해요.",
    ZeroDivisionError: "0으로 나누었어요. 나누는 수가 0이 되는 경우를 따로 처리해요.",
    IndexError: "리스트 범위를 벗어났어요. 인덱스는 0부터 시작하고, 마지막은 len()-1 이에요.",
    KeyError: "딕셔너리에 없는 키를 찾았어요. in 으로 먼저 확인해 보세요.",
    AttributeError: "그 자료형에는 없는 기능(메서드)을 불렀어요. 점(.) 뒤의 이름을 확인해요.",
    ModuleNotFoundError: "이 실행기에 없는 모듈이에요. 수업에서 배운 모듈(random 등)을 써 보세요.",
    RecursionError: "함수가 자기 자신을 끝없이 불렀어요. 멈추는 조건을 확인해요.",
    EOFError: "input()이 값을 더 기다려요. '입력값' 칸에 한 줄에 하나씩 적어 주세요.",
    "시간 초과": "6초 안에 끝나지 않아 멈췄어요. while문의 조건이 언젠가 거짓이 되는지 확인해요."
  };
  PC.explain = (r) => {
    if (!r.etype) return "";
    if (r.etype === "EOFError" && r.emsg === "__NEED_INPUT__") return ERR_TIPS.EOFError;
    return ERR_TIPS[r.etype] || "코드 실행 중 오류가 났어요. 오류가 난 줄을 확인해요.";
  };
  PC.errLine = (r) => {
    if (!r.etype) return "";
    if (r.etype === "EOFError" && r.emsg === "__NEED_INPUT__") return "EOFError: 입력값이 부족해요";
    if (r.timeout) return "시간 초과";
    return `${r.etype}${r.emsg ? ": " + r.emsg : ""}${r.eline ? ` (${r.eline}번째 줄)` : ""}`;
  };

  /* ---------- 자동 확인 ---------- */
  PC.checkCode = (task, code) => {
    const items = [];
    code = code.replace(/#[^\n]*/g, ""); // 주석은 빼고 확인
    (task.codeMust || []).forEach((c) => items.push({ name: c.msg, ok: new RegExp(c.re).test(code), code: true }));
    (task.codeMustNot || []).forEach((c) => items.push({ name: c.msg, ok: !new RegExp(c.re).test(code), code: true }));
    return items;
  };
  PC.judge = (test, r) => {
    const out = r.out || "";
    const needInput = r.etype === "EOFError" && r.emsg === "__NEED_INPUT__";
    if (r.etype && !(test.eofOk && needInput)) return { ok: false, msg: PC.errLine(r) };
    for (const s of test.expect || []) if (!out.includes(s)) return { ok: false, msg: `출력에 '${s}'가 보이지 않아요` };
    for (const s of test.notExpect || []) if (out.includes(s)) return { ok: false, msg: `출력에 '${s}'가 있으면 안 돼요` };
    for (const re of test.expectRe || []) if (!new RegExp(re, "m").test(out)) return { ok: false, msg: "출력 형식이나 값이 예상과 달라요" };
    if (test.numRange) {
      const m = out.match(new RegExp(test.numRange.re));
      const v = m ? parseFloat(m[1]) : NaN;
      if (!(v >= test.numRange.min && v <= test.numRange.max)) return { ok: false, msg: isNaN(v) ? "결과 숫자를 찾지 못했어요" : `${v}는 ${test.numRange.min}~${test.numRange.max} 범위 밖이에요` };
    }
    return { ok: true, msg: "" };
  };
  PC.runTests = async (task, code, onProgress) => {
    const items = [];
    for (const t of task.tests || []) {
      let src = code;
      if (t.replace) {
        if (!code.includes(t.replace[0])) { items.push({ name: t.name, ok: false, msg: `코드에서 '${t.replace[0]}' 값을 찾지 못했어요 (스타터 코드의 값을 지워 버렸나요?)` }); continue; }
        src = code.split(t.replace[0]).join(t.replace[1]);
      }
      if (t.append) src += "\n" + t.append;
      const r = await PC.run(src, t.stdin || "");
      const j = PC.judge(t, r);
      items.push({ name: t.name, ok: j.ok, msg: j.msg });
      onProgress && onProgress(items.length);
    }
    const codeItems = PC.checkCode(task, code);
    const runPassed = items.filter((i) => i.ok).length;
    return {
      items, codeItems,
      passed: runPassed + codeItems.filter((i) => i.ok).length,
      total: items.length + codeItems.length,
      runPassed, runTotal: items.length
    };
  };

  /* ---------- 파이썬 색칠 ---------- */
  const KW = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
  const BI = new Set("print input int float str bool len range list dict set tuple sum min max abs round sorted enumerate zip open type isinstance map filter".split(" "));
  const TOK = /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[fFrRbB]{0,2}"(?:\\.|[^"\\\n])*"?|[fFrRbB]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_가-힣][\w가-힣]*)/g;
  PC.highlight = (code) => {
    let html = "", last = 0, m, prevDef = false;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      html += PC.esc(code.slice(last, m.index));
      const t = m[0];
      let cls = "";
      if (m[1]) cls = "c"; else if (m[2]) cls = "s"; else if (m[3]) cls = "n";
      else if (KW.has(t)) cls = "k";
      else if (BI.has(t)) cls = "b";
      else if (prevDef || code[TOK.lastIndex] === "(") cls = "f";
      prevDef = m[4] && (t === "def" || t === "class");
      html += cls ? `<span class="t${cls}">${PC.esc(t)}</span>` : PC.esc(t);
      last = TOK.lastIndex;
    }
    return html + PC.esc(code.slice(last)) + "\n";
  };

  /* ---------- 코드 에디터 ---------- */
  PC.editor = (host, opts) => {
    opts = opts || {};
    host.classList.add("ed");
    host.innerHTML = `<div class="ed-gut" aria-hidden="true"></div><div class="ed-body"><pre class="ed-hl" aria-hidden="true"><code></code></pre><textarea class="ed-in" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="${PC.esc(opts.label || "코드 입력")}"></textarea></div>`;
    const ta = host.querySelector("textarea"), code = host.querySelector("code"), gut = host.querySelector(".ed-gut"), pre = host.querySelector("pre");
    if (opts.readOnly) ta.readOnly = true;
    let errLine = 0;
    const paint = () => {
      code.innerHTML = PC.highlight(ta.value);
      const n = ta.value.split("\n").length;
      let g = ""; for (let i = 1; i <= n; i++) g += `<span${i === errLine ? ' class="err"' : ""}>${i}</span>`;
      gut.innerHTML = g;
      ta.style.height = "auto";
      ta.style.height = Math.max(ta.scrollHeight, opts.minHeight || 260) + "px";
      pre.style.height = ta.style.height;
    };
    ta.addEventListener("input", () => { errLine = 0; paint(); opts.onChange && opts.onChange(ta.value); });
    ta.addEventListener("scroll", () => { pre.scrollLeft = ta.scrollLeft; });
    const insert = (text) => {
      if (!document.execCommand("insertText", false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    };
    ta.addEventListener("keydown", (e) => {
      if (ta.readOnly) return;
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      if (e.key === "Tab" && !e.shiftKey && s === en) { e.preventDefault(); insert("    "); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const endLine = v.indexOf("\n", en - 1 < s ? s : en - 1); const stop = endLine < 0 ? v.length : endLine;
        const block = v.slice(lineStart, stop);
        const nb = e.shiftKey ? block.replace(/^ {1,4}/gm, "") : block.replace(/^/gm, "    ");
        ta.setSelectionRange(lineStart, stop); insert(nb); ta.setSelectionRange(lineStart, lineStart + nb.length);
      } else if (e.key === "Enter" && !e.isComposing) {
        const line = v.slice(lineStart, s);
        let ind = (line.match(/^ */) || [""])[0];
        if (/:\s*(#.*)?$/.test(line)) ind += "    ";
        e.preventDefault(); insert("\n" + ind);
      } else if (e.key === "Backspace" && s === en && s > lineStart) {
        const before = v.slice(lineStart, s);
        if (/^ +$/.test(before) && before.length % 4 === 0) { e.preventDefault(); ta.setSelectionRange(s - 4, s); insert(""); }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); opts.onRun && opts.onRun(); }
    });
    paint();
    return {
      el: ta,
      get value() { return ta.value; },
      set value(v) { ta.value = v; paint(); },
      markError(line) { errLine = line || 0; paint(); },
      focus() { ta.focus(); }
    };
  };

  /* ---------- 스스로 기록기 ---------- */
  // 붙여넣기·끌어놓기 막기, 다른 창 이동, 타자 과정(재생용) 기록
  PC.tracker = (opts) => {
    const st = opts.state || {};
    const m = Object.assign({ startedAt: Date.now(), activeMs: 0, typed: 0, deleted: 0, pasteBlocked: 0, pasteChars: 0, dropBlocked: 0, bigInserts: 0, leaves: 0, awayMs: 0, runs: 0, errorRuns: 0, testRuns: 0, hints: 0, starter: false, thinkMs: 0 }, st.metrics || {});
    const rep = st.replay || { base: opts.editor.value, ev: [], t0: Date.now(), cut: false };
    let lastRec = st.lastRec != null ? st.lastRec : opts.editor.value;
    let internalClip = "";
    let awayStart = 0;
    const guarded = [opts.editor.el].concat(opts.guard || []);
    const warn = opts.onWarn || (() => {});
    const block = (e, kind, len) => {
      e.preventDefault();
      if (kind === "drop") m.dropBlocked++; else { m.pasteBlocked++; m.pasteChars += len || 0; }
      warn(kind, m);
      save();
    };
    guarded.forEach((el) => {
      el.addEventListener("copy", () => { internalClip = el.value.slice(el.selectionStart, el.selectionEnd); });
      el.addEventListener("cut", () => { internalClip = el.value.slice(el.selectionStart, el.selectionEnd); });
      el.addEventListener("paste", (e) => {
        const t = (e.clipboardData && e.clipboardData.getData("text")) || "";
        if (t && t === internalClip) return; // 같은 칸 안에서 복사한 것은 허용
        block(e, "paste", t.length);
      });
      el.addEventListener("drop", (e) => block(e, "drop"));
      el.addEventListener("beforeinput", (e) => {
        const it = e.inputType || "";
        if (it === "insertFromDrop") return block(e, "drop");
        if (it === "insertFromPaste") return; // paste 이벤트에서 처리
        if (el !== opts.editor.el) return;
        if (it.startsWith("insert") && e.data) m.typed += e.data.length;
        else if (it === "insertLineBreak" || it === "insertParagraph") m.typed += 1;
        else if (it.startsWith("delete")) m.deleted += Math.max(1, el.selectionEnd - el.selectionStart);
      });
    });
    let preLen = -1;
    opts.editor.el.addEventListener("beforeinput", () => { preLen = opts.editor.el.value.length; }, true);
    opts.editor.el.addEventListener("input", (e) => {
      if (preLen < 0) return;
      const d = opts.editor.el.value.length - preLen;
      preLen = -1;
      if (d > 40 && (e.inputType || "") !== "insertFromPaste") { m.bigInserts++; warn("big", m); save(); }
    });
    const onLeave = () => { if (!awayStart) awayStart = Date.now(); };
    const onBack = () => {
      if (!awayStart) return;
      const gone = Date.now() - awayStart; awayStart = 0;
      if (gone > 1500) { m.leaves++; m.awayMs += gone; warn("leave", m, gone); save(); }
    };
    const onVis = () => (document.hidden ? onLeave() : onBack());
    window.addEventListener("blur", onLeave);
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onVis);
    let size = JSON.stringify(rep).length;
    const record = () => {
      const cur = opts.editor.value;
      if (cur === lastRec || rep.cut) return;
      let p = 0; const a = lastRec, b = cur;
      while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let ea = a.length, eb = b.length;
      while (ea > p && eb > p && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
      const ev = [Math.round((Date.now() - rep.t0) / 1000), p, ea - p, b.slice(p, eb)];
      size += JSON.stringify(ev).length + 1;
      if (size > 40000) { rep.cut = true; return; }
      rep.ev.push(ev); lastRec = cur;
    };
    let ticks = 0;
    const iv = setInterval(() => {
      if (!document.hidden && document.hasFocus()) { m.activeMs += 1000; if (opts.phase && opts.phase() === "think") m.thinkMs += 1000; }
      ticks++;
      const every = size > 25000 ? 8 : 2;
      if (ticks % every === 0) record();
      if (ticks % 5 === 0) save();
    }, 1000);
    function save() { opts.onSave && opts.onSave({ metrics: m, replay: rep, lastRec }); }
    return {
      metrics: m,
      bump(k, n) { m[k] = (m[k] || 0) + (n == null ? 1 : n); save(); },
      set(k, v) { m[k] = v; save(); },
      snapshot() { record(); return { metrics: Object.assign({}, m), replay: JSON.parse(JSON.stringify(rep)) }; },
      save,
      stop() { clearInterval(iv); window.removeEventListener("blur", onLeave); window.removeEventListener("focus", onBack); document.removeEventListener("visibilitychange", onVis); }
    };
  };

  // 재생: base에 이벤트를 i번째까지 적용한 코드
  PC.replayAt = (rep, i) => {
    let c = rep.base || "";
    for (let k = 0; k < i && k < rep.ev.length; k++) { const [, p, d, s] = rep.ev[k]; c = c.slice(0, p) + s + c.slice(p + d); }
    return c;
  };

  /* ---------- 스스로 지수 (참고 지표) ---------- */
  PC.selfIndex = (m, code, starter) => {
    m = m || {};
    let s = 100; const notes = [];
    if (m.pasteBlocked) { s -= Math.min(45, m.pasteBlocked * 15); notes.push(`붙여넣기 시도 ${m.pasteBlocked}회 (${m.pasteChars || 0}자)`); }
    if (m.dropBlocked) { s -= Math.min(20, m.dropBlocked * 10); notes.push(`끌어놓기 시도 ${m.dropBlocked}회`); }
    if (m.bigInserts) { s -= Math.min(24, m.bigInserts * 8); notes.push(`한 번에 긴 글자 입력 ${m.bigInserts}회`); }
    if (m.leaves > 2) { s -= Math.min(30, (m.leaves - 2) * 4); }
    if (m.leaves) notes.push(`다른 창 이동 ${m.leaves}회 · ${PC.mins(m.awayMs)}`);
    const tot = (m.activeMs || 0) + (m.awayMs || 0);
    if (tot > 0 && m.awayMs / tot > 0.2) { s -= 15; notes.push(`과제 시간의 ${Math.round((m.awayMs / tot) * 100)}%를 다른 창에서 보냄`); }
    const added = Math.max(0, (code || "").length - (m.starter ? (starter || "").length : 0));
    if (added > 40 && (m.typed || 0) < added * 0.6) { s -= 20; notes.push(`직접 입력한 글자(${m.typed || 0})보다 코드가 훨씬 많음`); }
    if (added > 300 && (m.activeMs || 0) < 180000) { s -= 10; notes.push("아주 짧은 시간에 긴 코드 작성"); }
    if ((m.runs || 0) >= 3) { s += 5; notes.push(`실행하며 고친 횟수 ${m.runs}회`); }
    s = Math.max(0, Math.min(100, Math.round(s)));
    const level = s >= 80 ? "good" : s >= 60 ? "warn" : "bad";
    const label = s >= 80 ? "스스로 해결" : s >= 60 ? "확인 필요" : "대화 필요";
    return { score: s, level, label, notes };
  };

  /* ---------- 루브릭 ---------- */
  PC.RUBRIC = [
    { key: "acc", name: "정확성", max: 4, desc: "요구한 대로 동작하고 테스트를 통과해요" },
    { key: "think", name: "사고 과정", max: 3, desc: "문제를 나누고 순서(의사코드)를 세워 코드로 옮겼어요" },
    { key: "expr", name: "코드 표현", max: 3, desc: "변수 이름·들여쓰기·주석이 읽기 쉬워요" }
  ];
  PC.CT = [
    { key: "decomp", name: "문제 나누기", q: "이 문제를 작은 단계로 나누면?", ph: "예) ① 거스름돈 계산 ② 500원 개수 구하기 ③ 남은 돈으로 100원 개수 …" },
    { key: "io", name: "입력과 출력", q: "무엇을 받아서 무엇을 보여줘야 하나요?", ph: "예) 입력: 없음(넣은 돈 1000, 가격 650) / 출력: 동전별 개수" },
    { key: "pattern", name: "규칙 찾기", q: "반복되는 규칙이나 공식은?", ph: "예) 동전마다 '몫 = 개수, 나머지 = 남은 돈'이 똑같이 반복돼요" },
    { key: "algo", name: "순서 세우기", q: "코드를 쓰기 전에, 한국어로 순서를 적어요 (의사코드)", ph: "예)\n1. 거스름돈 = 넣은 돈 - 가격\n2. 500원 개수 = 거스름돈 // 500\n3. 거스름돈 = 거스름돈 % 500\n4. 100원, 50원, 10원도 반복" }
  ];

  /* ---------- 성장 보고서 ---------- */
  PC.reportData = (student, subs, range, classAvg) => {
    const [a, b] = range;
    const tasks = TASKS.filter((t) => t.day >= a && t.day <= b);
    const latest = PC.latest(subs.filter((s) => s.sid === student.sid));
    const rows = tasks.map((t) => {
      const s = latest[student.sid + "|" + t.id];
      return { task: t, sub: s || null, si: s ? PC.selfIndex(s.metrics, s.code, t.starter) : null, classAvg: classAvg ? classAvg[t.id] : null };
    });
    const done = rows.filter((r) => r.sub);
    const graded = done.filter((r) => r.sub.total != null && r.sub.total !== "");
    const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);
    const rub = {};
    PC.RUBRIC.forEach((k) => { rub[k.key] = avg(graded.filter((r) => r.sub.rubric).map((r) => Number(r.sub.rubric[k.key] || 0) / k.max)); });
    return {
      student, range, rows, done: done.length, total: rows.length,
      avgScore: avg(graded.map((r) => Number(r.sub.total))),
      classAvg: avg(graded.map((r) => r.classAvg).filter((v) => v != null)),
      selfAvg: avg(done.map((r) => r.si.score)),
      runsAvg: avg(done.map((r) => Number((r.sub.metrics || {}).runs || 0))),
      hintsTotal: done.reduce((x, r) => x + Number((r.sub.metrics || {}).hints || 0), 0),
      testRate: avg(done.filter((r) => r.sub.tests && r.sub.tests.total).map((r) => r.sub.tests.passed / r.sub.tests.total)),
      rubric: rub
    };
  };

  // 규칙 기반 종합 의견 초안 (선생님이 고쳐 쓰는 출발점)
  PC.draftComment = (d) => {
    const name = d.student.name;
    const out = [];
    const range = d.range[0] === d.range[1] ? `${d.range[0]}일차` : `${d.range[0]}~${d.range[1]}일차`;
    out.push(`${name} 학생은 ${range} 과제 ${d.total}개 중 ${d.done}개를 제출했어요.`);
    const best = d.rows.filter((r) => r.sub && r.sub.total != null).sort((x, y) => y.sub.total - x.sub.total)[0];
    if (best && best.sub.total >= 8) out.push(`특히 '${best.task.title}'에서 ${best.sub.total}점으로 문제를 정확하게 해결했어요.`);
    const r = d.rubric;
    if (r.think != null) {
      if (r.think >= 0.8) out.push("코드를 쓰기 전에 문제를 단계로 나누고 순서를 세우는 습관이 잘 자리 잡았어요.");
      else if (r.think < 0.5) out.push("다음에는 코드를 쓰기 전에 '문제 나누기'와 '순서 세우기'를 조금 더 자세히 적어 보세요. 생각이 정리되면 코드도 쉬워져요.");
    }
    if (r.expr != null && r.expr < 0.5) out.push("변수 이름을 뜻이 드러나게 짓고, 짧은 주석을 달면 코드가 훨씬 읽기 좋아져요.");
    if (d.runsAvg != null && d.runsAvg >= 4) out.push("실행하고 고치기를 여러 번 반복하며 끈기 있게 해결했어요.");
    if (d.selfAvg != null) {
      if (d.selfAvg >= 85) out.push("스스로 생각해서 끝까지 해결하는 모습이 돋보여요.");
      else if (d.selfAvg < 60) out.push("막힐 때 다른 창을 찾기보다, 힌트를 한 단계씩 열어 보며 스스로 해결해 보세요. 혼자 해낸 경험이 가장 큰 실력이 돼요.");
    }
    const miss = d.rows.filter((x) => !x.sub).map((x) => x.task.title);
    if (miss.length) out.push(`아직 제출하지 않은 과제(${miss.join(", ")})도 도전해 보세요.`);
    return out.join(" ");
  };

  const pct = (v) => (v == null ? "–" : Math.round(v * 100) + "%");
  PC.renderReport = (d, comment) => {
    const s = d.student;
    const range = d.range[0] === d.range[1] ? `${d.range[0]}일차` : `${d.range[0]}–${d.range[1]}일차`;
    const meter = (v, label) => `<div class="rp-meter"><span class="rp-mlabel">${label}</span><span class="rp-track"><i style="width:${v == null ? 0 : Math.round(v * 100)}%"></i></span><span class="rp-mval">${pct(v)}</span></div>`;
    const rows = d.rows.map((r) => {
      const sub = r.sub;
      const score = sub && sub.total != null && sub.total !== "" ? `${sub.total}<small>/10</small>` : sub ? `<span class="muted">채점 전</span>` : `<span class="muted">미제출</span>`;
      const tests = sub && sub.tests && sub.tests.total ? `${sub.tests.passed}/${sub.tests.total}` : "–";
      const ca = r.classAvg != null ? r.classAvg.toFixed(1) : "–";
      const fb = sub && sub.feedback ? `<div class="rp-fb">${PC.esc(sub.feedback)}</div>` : "";
      return `<tr><td><b>${r.task.id}</b> ${PC.esc(r.task.title)}${fb}</td><td class="num">${score}</td><td class="num">${ca}</td><td class="num">${tests}</td><td class="num">${r.si ? `<span class="si ${r.si.level}">${r.si.score}</span>` : "–"}</td></tr>`;
    }).join("");
    return `<article class="report">
      <header class="rp-head">
        <div><div class="rp-kicker">${PC.esc(CFG.SCHOOL || "")} · ${PC.esc(CFG.COURSE || "파이썬 기초")}</div>
        <h2>${PC.esc(s.name)} <span>${PC.esc(s.sid)}</span></h2>
        <div class="rp-range">${range} 성장 보고서</div></div>
        <div class="rp-score"><b>${d.avgScore == null ? "–" : d.avgScore.toFixed(1)}</b><span>평균 점수 / 10${d.classAvg != null ? ` · 반 평균 ${d.classAvg.toFixed(1)}` : ""}</span></div>
      </header>
      <section class="rp-stats">
        <div><b>${d.done}<small>/${d.total}</small></b><span>제출한 과제</span></div>
        <div><b>${pct(d.testRate)}</b><span>자동 확인 통과율</span></div>
        <div><b>${d.selfAvg == null ? "–" : Math.round(d.selfAvg)}</b><span>스스로 지수 평균</span></div>
        <div><b>${d.runsAvg == null ? "–" : d.runsAvg.toFixed(1)}</b><span>과제당 실행 횟수</span></div>
      </section>
      <section class="rp-rubric">
        <h3>영역별 성취</h3>
        ${PC.RUBRIC.map((k) => meter(d.rubric[k.key], k.name)).join("")}
      </section>
      <section>
        <h3>과제별 결과</h3>
        <div class="tbl-wrap"><table class="rp-table"><thead><tr><th>과제와 선생님 피드백</th><th class="num">점수</th><th class="num">반 평균</th><th class="num">자동 확인</th><th class="num">스스로</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      <section class="rp-comment"><h3>선생님 종합 의견</h3><p>${comment ? PC.esc(comment).replace(/\n/g, "<br>") : '<span class="muted">아직 작성되지 않았어요.</span>'}</p></section>
      <footer class="rp-foot">스스로 지수는 붙여넣기 시도, 다른 창 이동, 직접 입력한 양을 바탕으로 한 참고 지표예요. 점수에는 반영되지 않아요.</footer>
    </article>`;
  };
})();
