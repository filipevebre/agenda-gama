(function () {
  const NOTICE_KEY = "agenda-gama-last-staff-access-notice";

  const EQUIPE_SEED = [
    {
      id: "equipe-demo-1",
      nome: "Lucia Mendes",
      cargo: "Diretor",
      setor: "Direcao",
      contato: "(11) 99999-1001",
      email: "lucia@agendagama.com",
      access_status: "Acesso ativo"
    },
    {
      id: "equipe-demo-2",
      nome: "Rafael Costa",
      cargo: "Secretario",
      setor: "Secretaria",
      contato: "(11) 99999-1002",
      email: "rafael@agendagama.com",
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
      { key: "cargo", type: "tag" },
      { key: "setor" },
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
    if (document.getElementById("equipe-form") || document.getElementById("equipe-table-body")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function mountNoticeBanner() {
    const banner = document.getElementById("equipe-access-banner");
    if (!banner) return;

    const notice = consumeNotice();
    if (!notice) return;

    banner.hidden = false;
    banner.innerHTML = `
      <article class="hint-box">
        <div class="section-heading">
          <div>
            <h2>Acesso do funcionario preparado</h2>
            <p>O convite foi enviado pelo fluxo do Supabase e o funcionario vai definir a senha no primeiro acesso.</p>
          </div>
        </div>
        <div class="stack-sm">
          <p><strong>E-mail:</strong> ${escapeHtml(notice.email)}</p>
          <p><strong>Status:</strong> ${escapeHtml(notice.status || "Convite enviado")}</p>
          ${notice.mailActionText ? `<p>${escapeHtml(notice.mailActionText)}</p>` : ""}
        </div>
        ${notice.body ? `
          <div class="action-row">
            <button type="button" id="copy-staff-access-message" class="btn btn-secondary">Copiar mensagem</button>
          </div>
        ` : ""}
      </article>
    `;

    document.getElementById("copy-staff-access-message")?.addEventListener("click", function () {
      copyToClipboard(notice.body, this);
    });
  }

  async function buildSupabaseSave(record, previousRecord) {
    const siteUrl = await window.AgendaGamaSupabase.getSiteUrl();
    const response = await window.AgendaGamaSupabase.invokeFunction("provision-funcionario", {
      record,
      previousRecord,
      siteUrl
    });

    return {
      item: response.record,
      meta: {
        accessNotice: response.notice || null,
        redirectAfterSubmit: "equipe.html"
      }
    };
  }

  async function buildSupabaseDelete(record) {
    await window.AgendaGamaSupabase.invokeFunction("delete-funcionario-access", {
      record
    });
  }

  function mountCadastroPage() {
    ensureShellContent(function () {
      window.AgendaGamaForms.mountCrud({
        storageKey: "equipe",
        formId: "equipe-form",
        totalId: "total-equipe",
        feedbackId: "equipe-access-feedback",
        redirectAfterSubmit: "equipe.html",
        cancelRedirect: "equipe.html",
        columns: buildColumns(),
        seedData: EQUIPE_SEED,
        getFormData,
        customSave: async function ({ data, previousItem }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            return await buildSupabaseSave(data, previousItem);
          }

          const result = window.AgendaGamaAuth.provisionFuncionarioAccess(data, {
            previousRecord: previousItem
          });

          if (!result.ok) {
            return { error: result.error };
          }

          return {
            item: await window.AgendaGamaDataStore.save("equipe", {
              ...(previousItem || {}),
              ...data,
              email: result.user.email,
              access_status: result.accessStatus
            }, EQUIPE_SEED),
            meta: {
              accessNotice: {
                email: result.user.email,
                status: result.accessStatus,
                body: result.notice?.body || ""
              },
              redirectAfterSubmit: "equipe.html"
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
        storageKey: "equipe",
        tableBodyId: "equipe-table-body",
        emptyStateId: "equipe-empty",
        totalId: "total-equipe",
        editPageUrl: "cadastro-equipe.html",
        emptyMessage: "Nenhum funcionario cadastrado ainda.",
        columns: buildColumns(),
        seedData: EQUIPE_SEED,
        customDelete: async function ({ item }) {
          if (await window.AgendaGamaAuth.isSupabaseEnabled()) {
            await buildSupabaseDelete(item);
            return;
          }

          await window.AgendaGamaDataStore.remove("equipe", item.id, EQUIPE_SEED);
        },
        afterDelete: async function ({ item, items }) {
          if (!(await window.AgendaGamaAuth.isSupabaseEnabled())) {
            window.AgendaGamaAuth.removeFuncionarioAccess(item.email, items);
          }
        }
      });
    });
  }

  window.AgendaGamaEquipe = {
    mountCadastroPage,
    mountListPage
  };
})();
