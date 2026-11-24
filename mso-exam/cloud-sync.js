(function () {
  const CONFIGURED = () =>
    window.QSORT_SUPABASE_URL &&
    window.QSORT_SUPABASE_ANON_KEY &&
    !String(window.QSORT_SUPABASE_URL).includes("YOUR_") &&
    !String(window.QSORT_SUPABASE_ANON_KEY).includes("YOUR_");

  let client = null;
  let user = null;
  let opts = null;
  let saveTimer = null;
  let syncing = false;

  const el = (id) => document.getElementById(id);
  const status = (message, kind = "") => {
    const node = el("cloudStatus");
    if (!node) return;
    node.textContent = message;
    node.className = "cloud-status " + kind;
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

  function calculate(paperId, state) {
    const qs = opts.questions(paperId);
    const modules = [1,2,3,4,5,6,7].map((mod) => {
      const list = qs.filter((q) => q.module === mod);
      const correct = list.filter((q) => state.answers[String(q.id)] === q.answer).length;
      const wrong = list.filter((q) => state.answers[String(q.id)] != null && state.answers[String(q.id)] !== q.answer).length;
      return { module: mod, correct, wrong, passed: wrong <= 2 };
    });
    const score = qs.filter((q) => state.answers[String(q.id)] === q.answer).length;
    return { score, modules, passed: score >= 25 && modules.every((m) => m.passed) };
  }

  async function saveState(paperId, state) {
    if (!client || !user || syncing) return;
    const { error } = await client.from("exam_states").upsert({
      user_id: user.id, paper_id: paperId, state, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,paper_id" });
    if (error) status("云端保存失败：" + error.message, "error");
    else status("已同步至云端 · " + user.email, "ok");
  }

  function queueSave(paperId, state) {
    if (!user) return;
    clearTimeout(saveTimer);
    const snapshot = JSON.parse(JSON.stringify(state));
    saveTimer = setTimeout(() => saveState(paperId, snapshot), 650);
  }

  async function saveHistory(paperId, state, sourceKey) {
    if (!client || !user || !state.submitted) return;
    const result = calculate(paperId, state);
    const { error } = await client.from("exam_history").upsert({
      user_id: user.id,
      paper_id: paperId,
      paper_name: opts.paperName(paperId),
      score: result.score,
      passed: result.passed,
      module_results: result.modules,
      answers: state.answers,
      completed_at: new Date().toISOString(),
      source_key: sourceKey
    }, { onConflict: "user_id,source_key" });
    if (error) status("成绩历史保存失败：" + error.message, "error");
    else await loadHistory();
  }

  async function loadHistory() {
    if (!client || !user) return;
    const { data, error } = await client.from("exam_history")
      .select("paper_id,paper_name,score,passed,completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(50);
    if (error) {
      status("读取历史记录失败：" + error.message, "error");
      return;
    }
    const host = el("cloudHistory");
    if (!host) return;
    host.innerHTML = data.length ? data.map((row) => {
      const when = new Date(row.completed_at).toLocaleString();
      return '<div class="history-row"><span><b>' + esc(row.paper_name) +
        '</b><small>' + esc(when) + '</small></span><span class="' +
        (row.passed ? "passed" : "failed") + '">' + row.score + '/35 · ' +
        (row.passed ? "合格" : "不合格") + '</span></div>';
    }).join("") : '<small class="muted">尚无已交卷的历史成绩。</small>';
  }

  async function syncFromCloud() {
    if (!client || !user || syncing) return;
    syncing = true;
    status("正在同步六套试卷的数据…");
    try {
      const { data, error } = await client.from("exam_states")
        .select("paper_id,state,updated_at").eq("user_id", user.id);
      if (error) throw error;
      const remote = new Map((data || []).map((row) => [row.paper_id, row]));
      const ownerKey = "mso_cloud_owner_user_id";
      const previousOwner = localStorage.getItem(ownerKey);
      const mayMigrateLocal = !previousOwner || previousOwner === user.id;
      for (let id = 1; id <= 6; id++) {
        const key = opts.storageKey(id);
        const localRaw = localStorage.getItem(key);
        const localState = localRaw ? JSON.parse(localRaw) : null;
        const cloudRow = remote.get(id);
        if (cloudRow) {
          localStorage.setItem(key, JSON.stringify(cloudRow.state));
          if (id === opts.getActivePaper()) opts.applyState(id, cloudRow.state);
        } else if (localState && mayMigrateLocal) {
          const { error: writeError } = await client.from("exam_states").upsert({
            user_id: user.id, paper_id: id, state: localState, updated_at: new Date().toISOString()
          }, { onConflict: "user_id,paper_id" });
          if (writeError) throw writeError;
          if (localState.submitted) {
            await saveHistory(id, localState, "legacy-paper-" + id);
          }
        } else if (previousOwner && previousOwner !== user.id) {
          // Never transfer another account's local data into this account.
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(ownerKey, user.id);
      const activeId = opts.getActivePaper();
      const activeRaw = localStorage.getItem(opts.storageKey(activeId));
      opts.applyState(activeId, activeRaw ? JSON.parse(activeRaw) : null);
      await loadHistory();
      status("云端同步完成 · " + user.email, "ok");
    } catch (error) {
      status("同步失败：" + (error.message || error), "error");
    } finally {
      syncing = false;
    }
  }

  function showSignedIn() {
    el("cloudAuthForm").hidden = true;
    el("cloudSignedIn").hidden = false;
    el("cloudUser").textContent = user.email || "已登录";
  }

  function showSignedOut() {
    el("cloudAuthForm").hidden = false;
    el("cloudSignedIn").hidden = true;
    el("cloudHistory").innerHTML = "";
  }

  async function signIn(mode) {
    const email = el("cloudEmail").value.trim();
    const password = el("cloudPassword").value;
    if (!email || !password) return status("请输入邮箱和密码。", "error");
    status(mode === "signup" ? "正在创建账号…" : "正在登录…");
    const result = mode === "signup"
      ? await client.auth.signUp({ email, password })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) return status(result.error.message, "error");
    if (mode === "signup" && !result.data.session) {
      status("注册成功。请先到邮箱点击验证链接，再回来登录。", "ok");
    } else {
      status("登录成功，正在同步…", "ok");
    }
  }

  async function init(options) {
    opts = options;
    if (!CONFIGURED() || !window.supabase) {
      status("云端功能尚未启用：需要先填写 Supabase 项目配置。", "warn");
      el("cloudAuthForm").hidden = true;
      return;
    }
    client = window.supabase.createClient(window.QSORT_SUPABASE_URL, window.QSORT_SUPABASE_ANON_KEY);
    el("cloudLogin").addEventListener("click", () => signIn("login"));
    el("cloudSignup").addEventListener("click", () => signIn("signup"));
    el("cloudLogout").addEventListener("click", async () => {
      await client.auth.signOut();
      user = null;
      showSignedOut();
      status("已退出登录。本机答题记录仍会保留。", "ok");
    });
    el("cloudRefreshHistory").addEventListener("click", loadHistory);
    const { data } = await client.auth.getSession();
    user = data.session?.user || null;
    if (user) {
      showSignedIn();
      await syncFromCloud();
    } else {
      showSignedOut();
      status("请登录以启用跨设备同步；未登录时仍会保存在本机。", "warn");
    }
    client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      if (nextUser && (!user || nextUser.id !== user.id)) {
        user = nextUser;
        showSignedIn();
        setTimeout(syncFromCloud, 0);
      } else if (!nextUser && user) {
        user = null;
        showSignedOut();
      }
    });
  }

  window.QsortCloud = {
    init,
    queueSave,
    recordSubmission: (paperId, state) =>
      saveHistory(paperId, state, "attempt-" + crypto.randomUUID())
  };
})();
