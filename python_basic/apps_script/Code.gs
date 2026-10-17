/**
 * 파이썬 코딩 제출실 — 구글 시트 백엔드 (Apps Script)
 *
 * 1) 새 구글 시트를 만들고  확장 프로그램 → Apps Script 를 엽니다.
 * 2) 이 파일 내용을 Code.gs 에 통째로 붙여넣고, 아래 TEACHER_KEY 를 바꿉니다.
 * 3) 배포 → 새 배포 → 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자 → 배포
 * 4) 나온 웹 앱 URL(…/exec)을 python_basic/assets/config.js 의 API_URL 에 붙여넣습니다.
 *
 * 시트 탭 3개(students, submissions, reports)는 처음 요청이 올 때 자동으로 만들어져요.
 * 코드를 고친 뒤에는  배포 → 배포 관리 → 수정 → 새 버전  으로 다시 배포해야 반영돼요.
 */

const TEACHER_KEY = '여기에_교사_비밀번호를_적으세요';

const COLS = {
  students: ['sid', 'name', 'pinHash', 'createdAt', 'lastLogin'],
  submissions: ['id', 'at', 'sid', 'name', 'day', 'task', 'status', 'total', 'autoScore', 'testsPassed', 'testsTotal',
    'selfFlags', 'code', 'thinking', 'reflection', 'help', 'metrics', 'tests', 'rubric', 'feedback', 'gradedAt', 'replay'],
  reports: ['key', 'sid', 'range', 'comment', 'published', 'updatedAt']
};
const JSON_COLS = { thinking: 1, reflection: 1, help: 1, metrics: 1, tests: 1, rubric: 1, replay: 1 };
const CELL_MAX = 49000;

function doGet() {
  return out({ ok: true, msg: '파이썬 코딩 제출실 API가 작동 중이에요.' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: '요청 형식이 잘못됐어요.' }); }
  const fn = ACTIONS[req.action];
  if (!fn) return out({ ok: false, error: '알 수 없는 요청: ' + req.action });
  const lock = LockService.getScriptLock();
  const writes = { login: 1, submit: 1, grade: 1, saveReport: 1, resetPin: 1 };
  try {
    if (writes[req.action]) lock.waitLock(25000);
    return out(Object.assign({ ok: true }, fn(req)));
  } catch (err) {
    return out({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (writes[req.action]) lock.releaseLock();
  }
}

const ACTIONS = {
  login(r) {
    need(r, ['sid', 'name', 'pinHash']);
    const now = new Date().toISOString();
    const t = table('students');
    const row = t.find('sid', r.sid);
    if (!row) {
      t.append({ sid: r.sid, name: r.name, pinHash: r.pinHash, createdAt: now, lastLogin: now });
      return { student: { sid: r.sid, name: r.name }, created: true };
    }
    if (row.obj.pinHash !== r.pinHash) throw new Error('비밀번호가 맞지 않아요. 기억나지 않으면 선생님께 초기화를 부탁하세요.');
    if (row.obj.name !== r.name) throw new Error("이 학번은 '" + row.obj.name + "' 이름으로 등록되어 있어요.");
    t.update(row.index, { lastLogin: now });
    return { student: { sid: row.obj.sid, name: row.obj.name } };
  },

  submit(r) {
    const st = auth(r);
    const s = r.sub || {};
    const id = Utilities.getUuid().slice(0, 12);
    const at = new Date().toISOString();
    const tests = s.tests || {};
    const m = s.metrics || {};
    table('submissions').append({
      id: id, at: at, sid: st.sid, name: st.name, day: s.day, task: s.task, status: '제출됨', total: '',
      autoScore: s.autoScore, testsPassed: tests.passed, testsTotal: tests.total,
      selfFlags: '붙여넣기 ' + (m.pasteBlocked || 0) + ' · 창이동 ' + (m.leaves || 0),
      code: s.code, thinking: s.thinking, reflection: s.reflection, help: s.help, metrics: m, tests: tests,
      rubric: '', feedback: '', gradedAt: '', replay: s.replay
    });
    return { id: id, at: at };
  },

  mine(r) {
    const st = auth(r);
    const all = table('submissions').all();
    return {
      subs: all.filter(function (s) { return s.sid === st.sid; }).map(lite),
      reports: table('reports').all().filter(function (x) { return x.sid === st.sid && truthy(x.published); }),
      classStats: { taskAvg: taskAvg(all) }
    };
  },

  teacherAll(r) {
    teacher(r);
    return {
      subs: table('submissions').all().map(lite),
      students: table('students').all().map(function (s) { return { sid: s.sid, name: s.name, createdAt: s.createdAt, lastLogin: s.lastLogin }; }),
      reports: table('reports').all().map(function (x) { x.published = truthy(x.published); return x; })
    };
  },

  teacherGet(r) {
    teacher(r);
    const row = table('submissions').find('id', r.id);
    if (!row) throw new Error('제출물을 찾지 못했어요.');
    return { sub: row.obj };
  },

  grade(r) {
    teacher(r);
    const t = table('submissions');
    const row = t.find('id', r.id);
    if (!row) throw new Error('제출물을 찾지 못했어요.');
    const patch = { rubric: r.rubric, total: r.total, feedback: r.feedback || '', status: r.status || '피드백 완료', gradedAt: new Date().toISOString() };
    t.update(row.index, patch);
    return { sub: lite(Object.assign(row.obj, patch)) };
  },

  saveReport(r) {
    teacher(r);
    const t = table('reports');
    const key = r.sid + '|' + r.range;
    const rec = { key: key, sid: r.sid, range: r.range, comment: r.comment || '', published: !!r.published, updatedAt: new Date().toISOString() };
    const row = t.find('key', key);
    if (row) t.update(row.index, rec); else t.append(rec);
    return { report: rec };
  },

  resetPin(r) {
    teacher(r);
    const t = table('students');
    const row = t.find('sid', r.sid);
    if (row) t.sheet.deleteRow(row.index);
    return {};
  }
};

/* ---------- 도우미 ---------- */
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function need(r, keys) {
  keys.forEach(function (k) { if (r[k] == null || r[k] === '') throw new Error(k + ' 값이 없어요.'); });
}
function truthy(v) { return v === true || v === 'TRUE' || v === 'true'; }
function teacher(r) {
  if (TEACHER_KEY.indexOf('여기에') === 0) throw new Error('Apps Script의 TEACHER_KEY를 먼저 바꿔 주세요.');
  if (r.key !== TEACHER_KEY) throw new Error('교사 비밀번호가 맞지 않아요.');
}
function auth(r) {
  need(r, ['sid', 'pinHash']);
  const row = table('students').find('sid', r.sid);
  if (!row || row.obj.pinHash !== r.pinHash) throw new Error('로그인 정보가 맞지 않아요. 다시 로그인해 주세요.');
  return row.obj;
}
function lite(s) { const c = Object.assign({}, s); delete c.replay; return c; }
function taskAvg(all) {
  const latest = {};
  all.forEach(function (s) { const k = s.sid + '|' + s.task; if (!latest[k] || latest[k].at < s.at) latest[k] = s; });
  const by = {};
  Object.keys(latest).forEach(function (k) { const s = latest[k]; if (s.total === '' || s.total == null) return; (by[s.task] = by[s.task] || []).push(Number(s.total)); });
  const avg = {};
  Object.keys(by).forEach(function (k) { avg[k] = by[k].reduce(function (a, b) { return a + b; }, 0) / by[k].length; });
  return avg;
}

function table(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cols = COLS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const enc = function (k, v) {
    if (v == null) return '';
    if (JSON_COLS[k]) v = v === '' ? '' : JSON.stringify(v);
    if (typeof v === 'string' && v.length > CELL_MAX) v = k === 'replay' ? JSON.stringify({ base: '', ev: [], cut: true }) : v.slice(0, CELL_MAX);
    if (k === 'sid' || k === 'pinHash') return "'" + v; // 학번 앞의 0이 사라지지 않게
    return v;
  };
  const dec = function (row) {
    const o = {};
    cols.forEach(function (k, i) {
      let v = row[i];
      if (v instanceof Date) v = v.toISOString();
      if (JSON_COLS[k] && typeof v === 'string' && v !== '') { try { v = JSON.parse(v); } catch (e) {} }
      if (k === 'sid' || k === 'pinHash' || k === 'id' || k === 'key') v = String(v);
      o[k] = v;
    });
    return o;
  };
  return {
    sheet: sh,
    all: function () {
      const n = sh.getLastRow() - 1;
      if (n < 1) return [];
      return sh.getRange(2, 1, n, cols.length).getValues().map(dec);
    },
    find: function (key, val) {
      const n = sh.getLastRow() - 1;
      if (n < 1) return null;
      const ci = cols.indexOf(key) + 1;
      const vals = sh.getRange(2, ci, n, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0]) === String(val)) return { index: i + 2, obj: dec(sh.getRange(i + 2, 1, 1, cols.length).getValues()[0]) };
      }
      return null;
    },
    append: function (obj) { sh.appendRow(cols.map(function (k) { return enc(k, obj[k]); })); },
    update: function (index, patch) {
      Object.keys(patch).forEach(function (k) {
        const ci = cols.indexOf(k);
        if (ci >= 0) sh.getRange(index, ci + 1).setValue(enc(k, patch[k]));
      });
    }
  };
}
