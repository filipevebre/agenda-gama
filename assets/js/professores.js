(function () {
  const NOTICE_KEY = "agenda-gama-last-teacher-access-notice";

  const PROFESSORES_SEED = [
    {
      id: "prof-demo-1",
      nome: "Helena Souza",
      disciplinas: "Matematica, Historia",
      turno: "Manha",
      email: "helena@agendagama.com",
      access_status: "Acesso ativo"
    },
    {
      id: "prof-demo-2",
      nome: "Ricardo Lima",
      disciplinas: "Portugues",
      turno: "Tarde",
      email: "ricardo@agendagama.com",
      access_status: "Convite enviado"
    }
  ];

  function saveNotice(notice) {
    if (!notice) return;
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
  }

  function consumeNotice() {
    const raw = sessionStorage.getItem(NOTICE_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(NOTICE_KEY);

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function copyToClipboard(text, button) {
    if (!navigator.clipboard?.writeText) return;

    navigator.clipboard.writeText(text).then(function () {
      if (!button) return;
      const previousLabel = button.textContent;
      button.textContent = "Mensagem copiada";
      setTimeout(function () {
        button.textContent = previousLabel;
      }, 1800);
    });
  }

  function buildColumns() {
    return [
      { key: "nome" },
      { key: "disciplinas" },
      { key: "turno", type: "tag" },
      { key: "email" },
      {
        key: "access_status",
        render: function (value) {
          return `<span class="tag">${value || "Sem acesso"}</span>`;
        }
      }
    ];
  }

  function getSelectedDisciplinas() {
    const select = document.getElementById("professores-disciplinas");
    if (!select) return [];
    return Array.from(select.selectedOptions).map((option) => option.value);
  }

  function getFormData(form) {
    const formData = new FormData(form);
    return {
      nome: String(formData.get("nome") || ""),
      disciplinas: getSelectedDisciplinas().join(", "),
      turno: String(formData.get("turno") || ""),
      email: String(formData.get("email") || "").trim().toLowerCase()
    };
  }

  function populateForm(form, item) {
    form.elements.namedItem("nome").value = item.nome || "";
    form.elements.namedItem("turno").value = item.turno || "";
    form.elements.namedItem("email").value = item.email || "";
    const selecionadas = String(item.disciplinas || "")
      .split(",")
      .map((disciplina) => disciplina.trim())
      .filter(Boolean);

    Array.from(document.getElementById("professores-disciplinas").options).forEach((option) => {
      option.selected = selecionadas.includes(option.value);
    });
  }

  function afterSubmit() {
    const select = document.getElementById("professores-disciplinas");
    if (select) {
      select.selectedIndex = -1;
    }
  }

  function ensureShellContent(callback) {
    if (document.getElementById("professores-form") || document.getElementById("professores-table-body")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  async function carregarDisciplinas() {
    const select = document.getElementById("professores-disciplinas");
    if (!select) {
      window.addEventListener("agenda-shell-ready", function handleReady() {
        window.removeEventListener("agenda-shell-ready", handleReady);
        carregarDisciplinas();
      });
      return;
    }

    const disciplinas = await window.AgendaGamaDataStore.list("disciplinas");

    select.innerHTML = disciplinas.length
      ? disciplinas.map((disciplina) => `<option value="${disciplina.nome}">${disciplina.nome}</option>`).join("")
      : '<option value="" disabled>Nenhuma disciplina cadastrada</option>';

    select.size = Math.min(Math.max(disciplinas.length, 3), 6);
  }

  function mountNoticeBanner() {
    const banner = document.getElementById("professores-access-banner");
    if (!banner) return;

    const notice = consumeNotice();
    if (!notice) return;

    banner.hidden = false;
    banner.innerHTML = `
      <article class="hint-box">
        <div class="section-heading">
          <div>
            <h2>Acesso do professor preparado</h2>
            <p>O convite foi enviado pelo fluxo do Supabase e o professor vai definir a senha no primeiro acesso.</p>
          </div>
        </div>
        <div class="stack-sm">
          <p><strong>E-mail:</strong> ${escapeHtml(notice.email)}</p>
          <p><strong>Status:</strong> ${escapeHtml(notice.status || "Convite enviado")}</p>
          ${notice.mailActionText ? `<p>${escapeHtml(notice.mailActionText)}</p>` : ""}
        </div>
        ${notice.body ? `
          <div class="action-row">
            <button type="button" id="copy-teacher-access-message" class="btn btn-secondary">Copiar mensagem</button>
          </div>
        ` : ""}
      </article>
    `;

    document.getElementById("copy-teacher-access-message")?.addEventListener("click", function () {
      copyToClipboard(notice.body, this);
    });
  }

  async function buildSupabaseSave(record, previousRecord) {
    const siteUrl = await window.AgendaGamaSupabase.getSiteUrl();
    const response = await window.AgendaGamaSupabase.invokeFunction("provision-professor", {
      record,
      previousRecord,
      siteUrl
    });

    return {
      item: response.record,
      meta: {
        accessNotice: response.notice || null,
        redirectAfterSubmit: "professores.html"
      }
    };
  }

  async function buildSupabaseDelete(record) {
    await window.AgendaGamaSupabase.invokeFunction("delete-professor-access", {
      record
    });
  }

  function mountCadastroPage() {
    ensureShellContent(function () {
      carregarDisciplinas();

      window.AgendaGamaForms.mountCrud({
        storageKey: "professores",
        formId: "professores-form",
        totalId: "total-professores",
        feedbackId: "professor-access-feedback",
        redirectAfterSubmit: "professores.html",
        cancelRedirect: "professores.html",
        columns: buildColumns(),
        seedData: PROFESSORES_SEED,
        getFormData,
        populateForm,
        afterSubmit,
        customSave: async function ({ data, previousItem }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            return await buildSupabaseSave(data, previousItem);
          }

          const result = window.AgendaGamaAuth.provisionProfessorAccess(data, {
            previousRecord: previousItem
          });

          if (!result.ok) {
            return { error: result.error };
          }

          return {
            item: await window.AgendaGamaDataStore.save("professores", {
              ...(previousItem || {}),
              ...data,
              email: result.user.email,
              access_status: result.accessStatus
            }, PROFESSORES_SEED),
            meta: {
              accessNotice: {
                email: result.user.email,
                status: result.accessStatus,
                body: result.notice?.body || ""
              },
              redirectAfterSubmit: "professores.html"
            }
          };
        },
        afterSave: async function ({ meta }) {
          if (meta?.accessNotice) {
            saveNotice(meta.accessNotice);
          }
        }
      });
    });
  }

  function mountListPage() {
    ensureShellContent(function () {
      mountNoticeBanner();

      window.AgendaGamaForms.mountCrud({
        storageKey: "professores",
        tableBodyId: "professores-table-body",
        emptyStateId: "professores-empty",
        totalId: "total-professores",
        editPageUrl: "cadastro-professores.html",
        emptyMessage: "Nenhum professor cadastrado ainda.",
        columns: buildColumns(),
        seedData: PROFESSORES_SEED,
        customDelete: async function ({ item }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            await buildSupabaseDelete(item);
            return;
          }

          await window.AgendaGamaDataStore.remove("professores", item.id, PROFESSORES_SEED);
        },
        afterDelete: async function ({ item, items }) {
          if (!(await window.AgendaGamaAuth.isSupabaseEnabled())) {
            window.AgendaGamaAuth.removeProfessorAccess(item.email, items);
          }
        }
      });
    });
  }

  window.AgendaGamaProfessores = {
    mountCadastroPage,
    mountListPage
  };
})();
