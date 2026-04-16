(function () {
  window.AgendaGamaConfig = Object.assign(
    {
      supabaseUrl: "",
      supabaseAnonKey: "",
      functionsBaseUrl: "",
      siteUrl: typeof window !== "undefined" ? window.location.origin : ""
    },
    window.AgendaGamaConfig || {}
  );
})();
