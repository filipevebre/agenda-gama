(function () {
  const TURMAS_SEED = [
    { nome: "1o Ano A", turno: "Manha", sala: "Sala 01", ano: "2026" },
    { nome: "5o Ano B", turno: "Tarde", sala: "Sala 08", ano: "2026" }
  ];

  const ALUNOS_SEED = [
    { nome: "Ana Clara Silva", matricula: "20260045", turma: "5o Ano B", turno: "Tarde" },
    { nome: "Pedro Henrique", matricula: "20260051", turma: "1o Ano A", turno: "Manha" }
  ];

  let turmasCache = [];
  let alunosCache = [];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/gi, "")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureShellContent(callback) {
    if (document.getElementById("turmas-table-body") || document.getElementById("progressao-form")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function sortByNome(items) {
    return [...items].sort((left, right) => String(left.nome || "").localeCompare(String(right.nome || ""), "pt-BR", {
      numeric: true,
      sensitivity: "base"
    }));
  }

  async function loadData() {
    const [turmas, alunos] = await Promise.all([
      window.AgendaGamaDataStore.list("turmas", TURMAS_SEED),
      window.AgendaGamaDataStore.list("alunos", ALUNOS_SEED)
    ]);

    turmasCache = sortByNome(turmas);
    alunosCache = alunos || [];
  }

  function findTurma(value) {
    if (!value) return null;

    return turmasCache.find((turma) => turma.id === value)
      || turmasCache.find((turma) => normalizeText(turma.nome) === normalizeText(value))
      || null;
  }

  function getAlunosDaTurma(turma) {
    if (!turma) return [];
    return alunosCache.filter((aluno) => normalizeText(aluno.turma) === normalizeText(turma.nome));
  }

  function setFeedback(message, type) {
    const feedback = document.getElementById("progressao-feedback");
    if (!feedback) return;

    feedback.hidden = !message;
    feedback.textContent = message || "";
    feedback.className = type ? `feedback ${type} full` : "feedback full";
  }

  function setSubmittingState(isSubmitting) {
    const submitButton = document.getElementById("progressao-submit");
    if (!submitButton) return;

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Progredindo alunos..." : "Progredir alunos da turma";
  }

  function populateSelectOptions() {
    const origemSelect = document.getElementById("progressao-origem");
    const destinoSelect = document.getElementById("progressao-destino");
    if (!origemSelect || !destinoSelect) return;

    const previousOrigem = origemSelect.value;
    const previousDestino = destinoSelect.value;
    const options = turmasCache.map((turma) => (
      `<option value="${turma.id || turma.nome}">${escapeHtml(turma.nome)} - ${escapeHtml(turma.turno || "-")} - ${escapeHtml(turma.ano || "-")}</option>`
    )).join("");

    origemSelect.innerHTML = `<option value="">Selecione a turma atual</option>${options}`;
    destinoSelect.innerHTML = `<option value="">Selecione a proxima turma</option>${options}`;

    if (findTurma(previousOrigem)) {
      origemSelect.value = previousOrigem;
    }

    if (findTurma(previousDestino)) {
      destinoSelect.value = previousDestino;
    }
  }

  function renderSummary() {
    const origemSelect = document.getElementById("progressao-origem");
    const destinoSelect = document.getElementById("progressao-destino");
    const summary = document.getElementById("progressao-summary");
    if (!origemSelect || !destinoSelect || !summary) return;

    const origem = findTurma(origemSelect.value);
    const destino = findTurma(destinoSelect.value);

    if (!origem) {
      summary.hidden = true;
      summary.innerHTML = "";
      return;
    }

    const alunosDaTurma = getAlunosDaTurma(origem);
    const previewNames = alunosDaTurma.slice(0, 5).map((aluno) => escapeHtml(aluno.nome)).join(", ");

    summary.hidden = false;
    summary.innerHTML = `
      <p><strong>Turma atual:</strong> ${escapeHtml(origem.nome)} (${escapeHtml(origem.turno || "-")})</p>
      <p><strong>Alunos encontrados:</strong> ${alunosDaTurma.length}</p>
      ${previewNames ? `<p><strong>Exemplos:</strong> ${previewNames}${alunosDaTurma.length > 5 ? "..." : ""}</p>` : "<p>Nenhum aluno esta vinculado a esta turma no momento.</p>"}
      ${destino ? `<p><strong>Destino selecionado:</strong> ${escapeHtml(destino.nome)} (${escapeHtml(destino.turno || "-")})</p>` : "<p>Escolha a turma de destino para concluir a progressao.</p>"}
    `;
  }

  async function runProgression(event) {
    event.preventDefault();
    setFeedback("", "");
    setSubmittingState(true);

    try {
      await loadData();
      populateSelectOptions();

      const origem = findTurma(document.getElementById("progressao-origem")?.value);
      const destino = findTurma(document.getElementById("progressao-destino")?.value);

      if (!origem) {
        setFeedback("Selecione a turma de origem para continuar.", "error");
        return;
      }

      if (!destino) {
        setFeedback("Selecione a turma de destino para continuar.", "error");
        return;
      }

      if ((origem.id && destino.id && origem.id === destino.id) || normalizeText(origem.nome) === normalizeText(destino.nome)) {
        setFeedback("Escolha uma turma de destino diferente da turma de origem.", "error");
        return;
      }

      const alunosDaTurma = getAlunosDaTurma(origem);
      if (!alunosDaTurma.length) {
        setFeedback("Nao ha alunos vinculados a esta turma para progredir agora.", "error");
        return;
      }

      for (const aluno of alunosDaTurma) {
        await window.AgendaGamaDataStore.save("alunos", {
          ...aluno,
          turma: destino.nome,
          turno: destino.turno || ""
        }, ALUNOS_SEED);
      }

      await loadData();
      renderSummary();
      setFeedback(`${alunosDaTurma.length} aluno(s) foram movidos de ${origem.nome} para ${destino.nome}.`, "success");
    } catch (error) {
      setFeedback(error?.message || "Nao foi possivel concluir a progressao dos alunos agora.", "error");
    } finally {
      setSubmittingState(false);
    }
  }

  async function mountProgressionCard() {
    const form = document.getElementById("progressao-form");
    const origemSelect = document.getElementById("progressao-origem");
    const destinoSelect = document.getElementById("progressao-destino");

    if (!form || !origemSelect || !destinoSelect) return;
    if (form.dataset.progressionMounted === "true") return;
    form.dataset.progressionMounted = "true";

    await loadData();
    populateSelectOptions();
    renderSummary();

    origemSelect.addEventListener("change", renderSummary);
    destinoSelect.addEventListener("change", renderSummary);
    form.addEventListener("submit", runProgression);
  }

  function mountListPage() {
    ensureShellContent(function () {
      window.AgendaGamaForms.mountCrud({
        storageKey: "turmas",
        tableBodyId: "turmas-table-body",
        emptyStateId: "turmas-empty",
        totalId: "total-turmas",
        editPageUrl: "cadastro-turmas.html",
        emptyMessage: "Nenhuma turma cadastrada ainda.",
        columns: [{ key: "nome" }, { key: "turno", type: "tag" }, { key: "sala" }, { key: "ano" }],
        seedData: TURMAS_SEED
      });

      mountProgressionCard();
    });
  }

  window.AgendaGamaTurmas = {
    mountListPage
  };
})();
