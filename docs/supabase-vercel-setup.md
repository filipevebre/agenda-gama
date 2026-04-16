# Agenda Gama + Vercel + Supabase

## Arquitetura usada

- Frontend estatico: Vercel Hobby
- Banco, Auth e Edge Functions: Supabase Free
- Convite por e-mail de responsaveis: Supabase Auth

## 1. Configurar o frontend

Edite [assets/js/config.js](../assets/js/config.js) com:

- `supabaseUrl`
- `supabaseAnonKey`
- `siteUrl`

Exemplo:

```js
window.AgendaGamaConfig = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_ANON_KEY",
  siteUrl: "https://seu-dominio.vercel.app"
}
```

## 2. Aplicar o schema no Supabase

Execute a migration:

- [supabase/migrations/20260415_001_agenda_gama_init.sql](../supabase/migrations/20260415_001_agenda_gama_init.sql)

Ela cria:

- `profiles`
- `turmas`
- `disciplinas`
- `equipe`
- `professores`
- `alunos`
- `responsaveis`
- `communication_channels`
- `communication_messages`

## 3. Deploy das Edge Functions

Publique:

- `provision-responsavel`
- `delete-responsavel-access`

Arquivos:

- [supabase/functions/provision-responsavel/index.ts](../supabase/functions/provision-responsavel/index.ts)
- [supabase/functions/delete-responsavel-access/index.ts](../supabase/functions/delete-responsavel-access/index.ts)

## 4. Variaveis das Edge Functions

Defina no projeto Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`

`SITE_URL` deve apontar para a URL publica da Vercel, por exemplo:

- `https://agenda-gama.vercel.app`

A Edge Function do convite usa a `siteUrl` enviada pelo frontend e, se ela nao vier preenchida, usa `SITE_URL` como fallback.

## 5. Criar o primeiro administrador

No Supabase Auth, crie o usuario administrador e depois insira o perfil correspondente em `public.profiles`.

Exemplo de perfil:

```sql
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  role_label,
  can_approve,
  first_access_pending
)
values (
  'UUID_DO_AUTH_USER',
  'admin@gama.edu.br',
  'Amanda Gama',
  'administrador',
  'Administrador',
  true,
  false
);
```

## 6. E-mail real para responsaveis

O convite de responsavel usa o fluxo nativo do Supabase:

- a secretaria cadastra o responsavel
- a Edge Function chama `inviteUserByEmail`
- o Supabase envia o convite por e-mail
- o responsavel abre o link
- o app leva para `app/criar-senha.html`
- o responsavel define a senha no primeiro acesso

## 7. SMTP

Para testes, o Supabase oferece envio padrao com limite e disponibilidade reduzidos.

Para uso real de producao, configure SMTP no painel do Supabase.

Referencias oficiais:

- Password auth: https://supabase.com/docs/guides/auth/passwords
- Invite user by email: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
