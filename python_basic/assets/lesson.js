// 수업 페이지 공통 — 코드 복사 버튼
function copyText(id) {
  const btn = event && event.currentTarget;
  const text = document.getElementById(id).textContent;
  const done = () => {
    if (!btn) return;
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = "✅ 복사됐어요! 실행기에 붙여넣으세요";
    btn.classList.add("done");
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, 1800);
  };
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); }
    catch (e) { alert("복사에 실패했어요. 코드를 직접 선택해서 복사해 주세요."); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}
