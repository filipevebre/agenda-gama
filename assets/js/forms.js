(function () {
  function setFeedback(feedbackEl, message, type) {
    if (!feedbackEl) return;
    feedbackEl.hidden = !message;
    feedbackEl.textContent = message || "";
    feedbackEl.className = type ? `feedback ${type}` : "feedback";
  }

  function getErrorMessage(error, fallbackMessage) {
    if (!error) return fallbackMessage;
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    return fallbackMessage;
  }

  function setSubmittingState(submitButton, isSubmitting, idleLabel) {
    if (!submitButton) return;
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Salvando..." : idleLabel;
  }

  async function mountCrud(config) {
    const form = config.formId ? document.getElementById(config.formId) : null;
    const tableBody = config.tableBodyId ? document.getElementById(config.tableBodyId) : null;
    const searchInput = config.searchInputId ? document.getElementById(config.searchInputId) : null;

    if (!form && !tableBody) {
      window.addEventListener("agenda-shell-ready", function handleReady() {
        window.removeEventListener("agenda-shell-ready", handleReady);
        mountCrud(config);
      });
      return;
    }

    const mountFlagEl = form || tableBody;
    if (mountFlagEl?.dataset.crudMounted === "true") {
      return;
    }

    if (mountFlagEl) {
      mountFlagEl.dataset.crudMounted = "true";
    }

    const emptyState = config.emptyStateId ? document.getElementById(config.emptyStateId) : null;
    const totalEl = config.totalId ? document.getElementById(config.totalId) : null;
    const feedbackEl = config.feedbackId ? document.getElementById(config.feedbackId) : null;
    const table = tableBody ? tableBody.closest("table") : null;
    const headerRow = table?.querySelector("thead tr");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const defaultSubmitText = submitButton ? submitButton.textContent : "Salvar";
    let cancelButton = form ? form.querySelector(".crud-cancel") : null;
    let editingId = null;
    let items = [];

    if (headerRow && !headerRow.querySelector(".crud-actions-header")) {
      const th = document.createElement("th");
      th.textContent = "Acoes";
      th.className = "crud-actions-header";
      headerRow.appendChild(th);
    }

    if (submitButton && form && !cancelButton) {
      cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.textContent = "Cancelar edicao";
      cancelButton.className = "btn btn-secondary full crud-cancel";
      cancelButton.hidden = true;
      submitButton.insertAdjacentElement("afterend", cancelButton);
    }

    async function refreshItems() {
      items = await window.AgendaGamaDataStore.list(config.storageKey, config.seedData || []);
      if (totalEl) {
        totalEl.textContent = String(items.length).padStart(2, "0");
      }
    }

    function populateForm(item) {
      if (!form || !item) return;

      if (config.populateForm) {
        config.populateForm(form, item);
        return;
      }

      Object.entries(item).forEach(([key, value]) => {
        if (key === "id") return;
        const field = form.elements.namedItem(key);
        if (field) {
          field.value = value;
        }
      });
    }

    function resetEditingState() {
      editingId = null;
      if (submitButton) {
        submitButton.textContent = config.submitLabel || defaultSubmitText;
      }
      if (cancelButton) {
        cancelButton.hidden = true;
      }
      form?.reset();
      if (config.afterSubmit) {
        config.afterSubmit(form);
      }

      if (form) {
        const url = new URL(window.location.href);
        url.searchParams.delete("id");
        url.searchParams.delete("edit");
        window.history.replaceState({}, "", url.toString());
      }
    }

    function renderColumn(column, item) {
      if (typeof column.render === "function") {
        return column.render(item[column.key], item);
      }

      const value = item[column.key];
      if (column.type === "tag") {
        return `<span class="tag">${value || "-"}</span>`;
      }

      return value || "-";
    }

    function getVisibleItems() {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      if (!query) return items;

      return items.filter((item) => {
        const keys = config.searchKeys || Object.keys(item);
        return keys.some((key) => String(item[key] || "").toLowerCase().includes(query));
      });
    }

    function render() {
      if (!tableBody) return;

      const visibleItems = getVisibleItems();
      tableBody.innerHTML = visibleItems.map((item) => `
        <tr data-id="${item.id || ""}">
          ${config.columns.map((column) => `<td>${renderColumn(column, item)}</td>`).join("")}
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm crud-edit">Editar</button>
              <button type="button" class="btn btn-secondary btn-sm crud-delete">Excluir</button>
            </div>
          </td>
        </tr>
      `).join("");

      if (emptyState) {
        emptyState.hidden = visibleItems.length > 0;
        if (!visibleItems.length && searchInput?.value.trim()) {
          emptyState.textContent = config.searchEmptyMessage || "Nenhum registro encontrado para a busca informada.";
        } else if (config.emptyMessage) {
          emptyState.textContent = config.emptyMessage;
        }
      }
    }

    async function loadEditingStateFromUrl() {
      if (!form) return;

      const params = new URLSearchParams(window.location.search);
      const editingParam = params.get("id") || params.get("edit");
      if (!editingParam) return;

      const item = await window.AgendaGamaDataStore.getById(config.storageKey, editingParam, config.seedData || []);
      if (!item) return;

      editingId = item.id;
      populateForm(item);
      if (submitButton) {
        submitButton.textContent = config.editSubmitLabel || "Salvar alteracoes";
      }
      if (cancelButton) {
        cancelButton.hidden = false;
      }
    }

    try {
      await refreshItems();
      await loadEditingStateFromUrl();
      render();
    } catch (error) {
      items = [];
      render();
      setFeedback(feedbackEl, getErrorMessage(error, "Nao foi possivel carregar os dados desta tela agora."), "error");
    }

    form?.addEventListener("submit", async function (event) {
      event.preventDefault();
      setFeedback(feedbackEl, "", "");
      setSubmittingState(submitButton, true, config.submitLabel || defaultSubmitText);

      try {
        let data = config.getFormData
          ? config.getFormData(form)
          : Object.fromEntries(new FormData(form).entries());

        if (editingId) {
          data.id = editingId;
        }

        const previousItem = editingId ? items.find((item) => item.id === editingId) : null;
        let meta = null;

        if (config.beforeSave) {
          const result = await config.beforeSave({
            data,
            editingId,
            items: [...items],
            previousItem,
            form
          });

          if (result?.error) {
            setFeedback(feedbackEl, result.error, "error");
            return;
          }

          if (result && Object.prototype.hasOwnProperty.call(result, "data")) {
            data = result.data;
          }

          if (result?.meta) {
            meta = result.meta;
          }
        }

        let savedItem = null;

        if (config.customSave) {
          const customSaveResult = await config.customSave({
            data,
            editingId,
            items: [...items],
            previousItem,
            form
          });

          if (customSaveResult?.error) {
            setFeedback(feedbackEl, customSaveResult.error, "error");
            return;
          }

          savedItem = customSaveResult?.item || data;
          meta = customSaveResult?.meta || meta;
        } else {
          savedItem = await window.AgendaGamaDataStore.save(config.storageKey, data, config.seedData || []);
        }

        if (config.afterSave) {
          await config.afterSave({
            data,
            item: savedItem,
            editingId,
            previousItem,
            items: [...items],
            meta,
            form
          });
        }

        const redirectAfterSubmit = meta?.redirectAfterSubmit || config.redirectAfterSubmit;
        resetEditingState();
        await refreshItems();
        render();

        if (redirectAfterSubmit) {
          window.location.href = redirectAfterSubmit;
          return;
        }

        if (config.successMessage) {
          setFeedback(feedbackEl, config.successMessage, "success");
        }
      } catch (error) {
        setFeedback(feedbackEl, getErrorMessage(error, "Nao foi possivel salvar este cadastro agora."), "error");
      } finally {
        setSubmittingState(submitButton, false, editingId ? (config.editSubmitLabel || "Salvar alteracoes") : (config.submitLabel || defaultSubmitText));
      }
    });

    cancelButton?.addEventListener("click", function () {
      setFeedback(feedbackEl, "", "");
      resetEditingState();
      if (config.cancelRedirect) {
        window.location.href = config.cancelRedirect;
      }
    });

    searchInput?.addEventListener("input", render);

    tableBody?.addEventListener("click", async function (event) {
      const row = event.target.closest("tr");
      if (!row) return;

      const id = row.dataset.id;
      if (!id) return;
      const item = items.find((currentItem) => currentItem.id === id);
      if (!item) return;

      if (event.target.closest(".crud-delete")) {
        setFeedback(feedbackEl, "", "");

        try {
          if (config.beforeDelete) {
            const result = await config.beforeDelete({
              id,
              item,
              items: [...items]
            });

            if (result?.error) {
              setFeedback(feedbackEl, result.error, "error");
              return;
            }

            if (result?.cancel) {
              return;
            }
          }

          if (config.customDelete) {
            const deleteResult = await config.customDelete({
              id,
              item,
              items: [...items]
            });

            if (deleteResult?.error) {
              setFeedback(feedbackEl, deleteResult.error, "error");
              return;
            }
          } else {
            await window.AgendaGamaDataStore.remove(config.storageKey, id, config.seedData || []);
          }

          if (config.afterDelete) {
            await config.afterDelete({
              id,
              item,
              items: [...items]
            });
          }

          await refreshItems();
          render();
        } catch (error) {
          setFeedback(feedbackEl, getErrorMessage(error, "Nao foi possivel excluir este registro agora."), "error");
        }
        return;
      }

      if (event.target.closest(".crud-edit")) {
        setFeedback(feedbackEl, "", "");
        if (config.editPageUrl) {
          window.location.href = `${config.editPageUrl}?id=${encodeURIComponent(id)}`;
          return;
        }

        editingId = id;
        populateForm(item);
        if (submitButton) {
          submitButton.textContent = config.editSubmitLabel || "Salvar alteracoes";
        }
        if (cancelButton) {
          cancelButton.hidden = false;
        }
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  window.AgendaGamaForms = { mountCrud };
})();
