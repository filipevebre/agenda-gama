(function () {
  const NOTICE_KEY = "agenda-gama-last-access-notice";

  const RESPONSAVEIS_SEED = [
    {
      id: "resp-demo-1",
      nome: "Mariana Alves",
      parentesco: "Mae",
      aluno: "Ana Clara Silva",
      contato: "(11) 99999-2201",
      email: "responsavel@gama.edu.br",
      access_status: "Acesso ativo"
    },
    {
      id: "resp-demo-2",
      nome: "Renato Henrique",
      parentesco: "Pai",
      aluno: "Pedro Henrique",
      contato: "(11) 99999-2202",
      email: "renato.henrique@gama.edu.br",
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
      { key: "parentesco", type: "tag" },
      { key: "aluno" },
      { key: "contato" },
      { key: "email" },
      {
        key: "access_status",
        render: function (value) {
          return `<span class="tag">${value || "Sem acesso"}</span>`;
        }
      }
    ];
  }

  function getFormData(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      ...data,
      email: String(data.email || "").trim().toLowerCase()
    };
  }

  function ensureShellContent(callback) {
    if (document.getElementById("responsaveis-form") || document.getElementById("responsaveis-table-body")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function mountNoticeBanner() {
    const banner = document.getElementById("responsaveis-access-banner");
    if (!banner) return;

    const notice = consumeNotice();
    if (!notice) return;

    banner.hidden = false;
    banner.innerHTML = `
      <article class="hint-box">
        <div class="section-heading">
          <div>
            <h2>Acesso do responsavel preparado</h2>
            <p>O convite foi enviado pelo fluxo do Supabase e o responsavel vai definir a senha no primeiro acesso.</p>
          </div>
        </div>
        <div class="stack-sm">
          <p><strong>E-mail:</strong> ${escapeHtml(notice.email)}</p>
          <p><strong>Status:</strong> ${escapeHtml(notice.status || "Convite enviado")}</p>
          ${notice.mailActionText ? `<p>${escapeHtml(notice.mailActionText)}</p>` : ""}
        </div>
        ${notice.body ? `
          <div class="action-row">
            <button type="button" id="copy-access-message" class="btn btn-secondary">Copiar mensagem</button>
          </div>
        ` : ""}
      </article>
    `;

    document.getElementById("copy-access-message")?.addEventListener("click", function () {
      copyToClipboard(notice.body, this);
    });
  }

  async function buildSupabaseSave(record, previousRecord) {
    const siteUrl = await window.AgendaGamaSupabase.getSiteUrl();
    const response = await window.AgendaGamaSupabase.invokeFunction("provision-responsavel", {
      record,
      previousRecord,
      siteUrl
    });

    return {
      item: response.record,
      meta: {
        accessNotice: response.notice || null,
        redirectAfterSubmit: "responsaveis.html"
      }
    };
  }

  async function buildSupabaseDelete(record) {
    await window.AgendaGamaSupabase.invokeFunction("delete-responsavel-access", {
      record
    });
  }

  function mountCadastroPage() {
    ensureShellContent(function () {
      window.AgendaGamaForms.mountCrud({
        storageKey: "responsaveis",
        formId: "responsaveis-form",
        totalId: "total-responsaveis",
        feedbackId: "responsavel-access-feedback",
        redirectAfterSubmit: "responsaveis.html",
        cancelRedirect: "responsaveis.html",
        columns: buildColumns(),
        seedData: RESPONSAVEIS_SEED,
        getFormData,
        customSave: async function ({ data, previousItem }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            return await buildSupabaseSave(data, previousItem);
          }

          const result = window.AgendaGamaAuth.provisionResponsibleAccess(data, {
            previousRecord: previousItem
          });

          if (!result.ok) {
            return { error: result.error };
          }

          return {
            item: await window.AgendaGamaDataStore.save("responsaveis", {
              ...(previousItem || {}),
              ...data,
              email: result.user.email,
              access_status: result.accessStatus
            }, RESPONSAVEIS_SEED),
            meta: {
              accessNotice: {
                email: result.user.email,
                status: result.accessStatus,
                body: result.notice?.body || ""
              },
              redirectAfterSubmit: "responsaveis.html"
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
        storageKey: "responsaveis",
        tableBodyId: "responsaveis-table-body",
        emptyStateId: "responsaveis-empty",
        totalId: "total-responsaveis",
        editPageUrl: "cadastro-responsaveis.html",
        emptyMessage: "Nenhum responsavel cadastrado ainda.",
        columns: buildColumns(),
        seedData: RESPONSAVEIS_SEED,
        customDelete: async function ({ item }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            await buildSupabaseDelete(item);
            return;
          }

          await window.AgendaGamaDataStore.remove("responsaveis", item.id, RESPONSAVEIS_SEED);
        },
        afterDelete: async function ({ item, items }) {
          if (!(await window.AgendaGamaAuth.isSupabaseEnabled())) {
            window.AgendaGamaAuth.removeResponsibleAccess(item.email, items);
          }
        }
      });
    });
  }

  window.AgendaGamaResponsaveis = {
    mountCadastroPage,
    mountListPage
  };
})();
