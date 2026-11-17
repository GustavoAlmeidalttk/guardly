# Guardly — Gerenciador de Testes

MVP das Sprints 1 a 3 para cadastrar testes e cenários, executá-los manualmente, consultar resultados anteriores e analisar estaticamente trechos de código JavaScript. O frontend usa React e Vite; a API REST usa Express e persiste os dados das duas primeiras sprints no **Cloud Firestore** por meio do Firebase Admin SDK. O armazenamento foi alterado de PostgreSQL/Prisma para Firestore por solicitação posterior.

## Estrutura

```text
gerenciador-testes/
├── backend/
│   ├── src/
│   │   ├── config/firestore.js    # conexão com Firebase
│   │   ├── analyzers/             # worker ESLint e normalização
│   │   ├── controllers/           # respostas HTTP
│   │   ├── middlewares/           # erros centralizados
│   │   ├── routes/                # rotas REST
│   │   ├── services/              # validação e persistência
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/api.test.js        # API com Firestore simulado
│   ├── tests/security.test.js   # análise estática e falhas
│   ├── tests/firestore.integration.mjs
│   ├── .env.example               # nuvem
│   └── .env.emulator.example      # emulador local
├── frontend/
│   ├── public/
│   ├── src/                       # componentes, hooks, páginas e cliente da API
│   └── .env.example
└── firebase.json                  # configuração do emulador
```

Os testes ficam em `testes/{testId}` e os cenários em `testes/{testId}/cenarios/{cenarioId}`. Cada teste armazena uma contagem de cenários. A subcoleção `nomesDeCenarios` reserva o primeiro uso de cada nome normalizado, permitindo detectar duplicidade atomicamente. `suiteId` é reservado para futuras suítes. O Firestore cria as coleções quando os primeiros documentos são gravados; não há migrações Prisma.

Cada execução fica em `testes/{testId}/cenarios/{cenarioId}/execucoes/{executionId}`. Ao iniciar, recebe `status: "em_andamento"` e `iniciadoEm`. Ao finalizar, a API grava `resultado` (`aprovado`, `reprovado` ou `bloqueado`), `responsavel`, `evidencias` (descrição ou link), `finalizadoEm` e `status: "finalizada"`. Uma transação atualiza o mesmo documento e grava `ultimoResultado` e `ultimaExecucaoEm` no cenário. O histórico retorna apenas execuções finalizadas, mais recentes primeiro. Cenários criados antes da Sprint 2 continuam válidos; os novos campos são opcionais nos documentos antigos.

## Pré-requisitos no Windows

- Node.js 22 ou superior e npm. Confira com `node --version` e `npm --version`.
- Para o Firestore na nuvem: projeto Firebase, banco Cloud Firestore criado e uma chave de conta de serviço para o backend. [Configuração oficial do Admin SDK](https://firebase.google.com/docs/admin/setup).
- Para desenvolvimento sem conta Firebase: Java 21 ou superior para executar o emulador. O script detecta o JDK 21 do Eclipse Adoptium neste Windows quando o Java padrão é antigo. Os testes unitários não exigem Firebase nem Java.

Instale as dependências em cada pasta (o comando da raiz instala backend e frontend):

```powershell
cd 'C:\caminho\para\gerenciador-testes'
npm install
npm run install:all
Copy-Item frontend\.env.example frontend\.env
```

## Opção A — Firestore na nuvem

1. Use seu projeto Firebase e habilite o **Cloud Firestore** no [Firebase Console](https://console.firebase.google.com/), caso ainda não esteja habilitado.
2. Em *Configurações do projeto → Contas de serviço*, gere uma chave privada para o Firebase Admin SDK. Guarde o JSON **fora do repositório**. O backend usa esse arquivo; o frontend nunca recebe a chave.
3. Copie `backend\.env.example` para `backend\.env`. Configure `FIREBASE_PROJECT_ID` e `GOOGLE_APPLICATION_CREDENTIALS` com o caminho absoluto do JSON. Em Windows, prefira barras `/` no valor do caminho.

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

Exemplo de configuração, substituindo os valores ilustrativos:

```dotenv
FIREBASE_PROJECT_ID=seu-projeto-firebase
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/SeuUsuario/segredos/firebase-admin.json
PORT=3000
HOST=127.0.0.1
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

4. A API usa o Admin SDK com credenciais de servidor; o frontend nunca acessa o Firestore diretamente. **Este projeto não altera as regras Firestore do projeto Firebase existente.** A API atual não tem autenticação de usuários e deve ser usada em ambiente de desenvolvimento ou rede confiável.
5. Inicie a API e o frontend conforme a seção **Iniciar a aplicação**. Os dados salvos na nuvem permanecem após reiniciar os servidores.

Para conferir a conexão com uma consulta somente de leitura, execute `npm run check:firestore` dentro de `backend`. Ele informa se a conexão usada é a nuvem ou o emulador, sem imprimir documentos.

## Opção B — Emulador local, sem conta Firebase

O emulador permite testar a API e a interface sem criar um projeto ou baixar uma chave privada. Os dados do emulador ficam em memória e podem desaparecer quando ele é encerrado; use o Firestore na nuvem para persistência permanente.

Neste computador, o Java padrão é 17, mas o script `npm run emulator` seleciona o JDK 21 já instalado. Em outro computador, instale Java 21 ou configure `JAVA_HOME` para ele.

```powershell
cd 'C:\caminho\para\gerenciador-testes'
Copy-Item backend\.env.emulator.example backend\.env
npm run emulator
```

Deixe esse terminal aberto. O backend conecta-se automaticamente ao emulador em `127.0.0.1:8080` quando `FIRESTORE_EMULATOR_HOST` está configurado. A interface do emulador geralmente é exibida em `http://localhost:4000`. Não coloque `http://` em `FIRESTORE_EMULATOR_HOST`.

## Iniciar a aplicação

Em um segundo terminal:

```powershell
cd 'C:\caminho\para\gerenciador-testes\backend'
npm run dev
```

Em um terceiro terminal:

```powershell
cd 'C:\caminho\para\gerenciador-testes\frontend'
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente [http://localhost:5173](http://localhost:5173). Se a porta 5173 estiver ocupada, ele pode usar `http://localhost:5174`. O backend usa `http://127.0.0.1:3000`. Se mudar `PORT`, ajuste também `VITE_API_URL` em `frontend\.env`. `CORS_ORIGIN` aceita uma lista de origens separadas por vírgula; inclua a porta exibida pelo Vite. Por padrão, ambos os servidores de desenvolvimento aceitam apenas conexões locais.

## Testes e build

```powershell
cd 'C:\caminho\para\gerenciador-testes'
npm test
npm run build
```

Os testes Supertest usam uma implementação simulada do Firestore e verificam validação, vínculo, listagem, duplicidade, execução e histórico. Os testes da interface usam React Testing Library. Para verificar transações e persistência no emulador, deixe `npm run emulator` aberto e, em outro PowerShell, execute:

```powershell
cd 'C:\caminho\para\gerenciador-testes\backend'
$env:FIREBASE_PROJECT_ID='demo-guardly'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
npm run test:firestore
```

Esse teste só aceita um emulador local, evitando gravações acidentais na nuvem. Ele também abre um segundo processo para confirmar que o histórico não depende da memória da API. Os testes automatizados não substituem uma verificação funcional do projeto Firebase de produção.

Os testes da Sprint 3 executam o worker ESLint sobre exemplos controlados de JavaScript; eles **não executam os trechos enviados**. Cobrem achado conhecido, ausência de ocorrências, validação de entrada, sintaxe inválida, falha da ferramenta e timeout.

## API REST

Todas as respostas usam JSON. IDs são UUIDs, mantidos para preservar o contrato da API. Campos opcionais são gravados como strings vazias.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/health` | Verifica se a API está respondendo |
| POST | `/api/tests` | Cadastra teste |
| GET | `/api/tests` | Lista testes com contagem de cenários |
| GET | `/api/tests/:id` | Consulta um teste |
| POST | `/api/tests/:testId/scenarios` | Cadastra cenário |
| PUT | `/api/tests/:testId/scenarios/:scenarioId/risks` | Associa riscos de uma análise existente ao cenário |
| GET | `/api/tests/:testId/security-suggestions` | Lista sugestões do teste |
| POST | `/api/tests/:testId/security-suggestions` | Gera sugestões relacionadas aos riscos de `{ "analysisId": "..." }` |
| PATCH | `/api/tests/:testId/security-suggestions/:suggestionId` | Aceita ou descarta sugestão; aceite recebe `status: "aceita"` e opcional `scenario` revisado |
| PUT | `/api/tests/:testId/scenarios/:scenarioId/risks` | Associa riscos de uma análise existente ao cenário |
| GET | `/api/tests/:testId/scenarios` | Lista cenários do teste |
| POST | `/api/tests/:testId/scenarios/:scenarioId/executions` | Inicia uma execução e devolve os dados do cenário |
| PATCH | `/api/tests/:testId/scenarios/:scenarioId/executions/:executionId` | Finaliza uma execução |
| GET | `/api/tests/:testId/scenarios/:scenarioId/executions` | Histórico finalizado, mais recente primeiro |
| POST | `/api/security/analyze` | Analisa estaticamente um trecho de JavaScript |

Cadastro de teste:

```json
{ "nome": "Validação de login", "descricao": "Verifica acesso", "passos": "Abrir a página de login" }
```

Cadastro de cenário:

```json
{ "nome": "Senha incorreta", "descricao": "Valida a rejeição de credenciais", "preCondicoes": "Usuário ativo", "passos": "Abrir login\nInformar senha errada", "resultadoEsperado": "Acesso negado" }
```

`nome` é obrigatório e tem limite de 160 caracteres. Entradas inválidas retornam `400`; teste inexistente, `404`. Um nome de cenário já usado **no mesmo teste**, ignorando maiúsculas/minúsculas e espaços nas extremidades, retorna `409` com `code: "DUPLICATE_SCENARIO"` sem criar outro cenário. A interface permite cancelar ou reenviar com `"confirmarDuplicidade": true`. O cadastro usa transação Firestore para proteger a reserva do nome e a contagem do teste.

### Execução manual e histórico (Sprint 2)

`POST` na rota de execuções não exige corpo. Retorna `201` com ID, data de início e o cenário, incluindo passos, pré-condições e resultado esperado. A interface permite acompanhar cada linha dos passos com uma caixa de seleção; marcar passos não altera o resultado automaticamente.

Para finalizar, envie `PATCH` com:

```json
{ "resultado": "reprovado", "responsavel": "Ana QA", "evidencias": "https://exemplo.com/evidencia" }
```

`resultado` aceita apenas `aprovado`, `reprovado` ou `bloqueado`; `responsavel` é obrigatório; `evidencias` é opcional e pode ser texto ou um link. A data de conclusão é gerada no servidor. Repetir a mesma finalização devolve o registro já salvo, sem criar outro. Tentar alterar uma execução finalizada retorna `409` com `EXECUTION_ALREADY_FINISHED`. IDs inválidos retornam `400`; teste, cenário ou execução inexistentes retornam `404`.

Exemplo de registro no Firestore e na resposta do histórico:

```json
{
  "id": "uuid-da-execucao",
  "testeId": "uuid-do-teste",
  "cenarioId": "uuid-do-cenario",
  "status": "finalizada",
  "resultado": "reprovado",
  "responsavel": "Ana QA",
  "evidencias": "https://exemplo.com/evidencia",
  "iniciadoEm": "2026-11-17T12:00:00.000Z",
  "finalizadoEm": "2026-11-17T12:05:00.000Z"
}
```

O histórico mostra data e horário, responsável, resultado e evidências. Resultados são identificados por texto e cor. Uma execução iniciada e abandonada permanece como `em_andamento`, mas não aparece no histórico até ser finalizada. Não há upload de arquivos nem retomada de execução interrompida nesta sprint.

### Análise de segurança (Sprint 3)

A aplicação aceita **JavaScript** (`language: "javascript"` ou `"js"`). O código é obrigatório e limitado a **50 KB em UTF-8**. A interface permite indicar que ele foi gerado por IA e informar a ferramenta. O código-fonte não é persistido: somente metadados e resultados são gravados em `analisesSeguranca/{analysisId}`.

```json
{
  "code": "const value = userInput;\neval(value);",
  "language": "javascript",
  "generatedByAI": true,
  "aiTool": "Ferramenta de IA"
}
```

Resposta resumida de exemplo:

```json
{
  "analysisId": "uuid-da-analise",
  "analyzedAt": "2026-11-17T12:00:00.000Z",
  "language": "javascript",
  "generatedByAI": true,
  "aiTool": "Ferramenta de IA",
  "analyzer": "ESLint + eslint-plugin-security",
  "status": "risks_found",
  "risks": [
    {
      "type": "Execução dinâmica de código",
      "severity": "alta",
      "description": "eval can be harmful.",
      "location": { "line": 2, "column": 1 },
      "ruleId": "no-eval",
      "analyzer": "ESLint + eslint-plugin-security"
    }
  ]
}
```

O analisador utiliza **ESLint 9** com `eslint-plugin-security 4` e regras nativas `no-eval` e `no-implied-eval`. As regras vêm fixas no backend; o usuário não escolhe configuração nem plugins. A classificação é determinística: `no-eval`/`no-implied-eval` = crítica; regras de processo, caminho de arquivo, require não literal, regex custosa e object injection = alta; avisos do ESLint = baixa; demais erros do ESLint = média. Essa matriz é uma triagem do projeto, não uma avaliação completa de explorabilidade. A localização vem das linhas e colunas fornecidas pelo ESLint.

Cada risco retorna `type`, `description`, `severity`, `location`, `ruleId`, `analyzer` e `recommendation` com uma orientação de correção. O `POST` devolve `status: "no_findings"`, `risks: []` e `"Nenhum risco identificado pelas regras configuradas."` somente quando a ferramenta conclui sem ocorrências. O relatório salvo não contém o código enviado. Código vazio retorna `400`, código acima do limite `413`, linguagem não suportada ou sintaxe inválida `422`, falha do analisador `502`, timeout `504` e excesso de análises simultâneas `429`. Nenhum desses erros é apresentado como análise limpa.

O frontend exporta o objeto de resposta em **JSON**, contendo data, linguagem, ferramenta de IA, analisador e riscos, sem o código submetido.

#### Limites de segurança

O modo padrão exige o contêiner Docker (`ANALYZER_MODE=docker` no `backend/.env`). Construa a imagem com `docker build -f backend/Dockerfile.analyzer -t guardly-analyzer:local backend`. O modo aplica rede desabilitada, limites de memória/CPU/PIDs, usuário não privilegiado, filesystem read-only, capacidades removidas, `no-new-privileges`, `/tmp` temporário e timeout de 8 segundos. Se o daemon ou a imagem não estiverem disponíveis, a análise falha com erro explícito. `ANALYZER_MODE=process-dev` habilita o worker legado somente para desenvolvimento/testes controlados; esse modo não é sandbox e não deve ser usado para processar submissões não confiáveis em produção. O build da imagem e a análise controlada em contêiner foram executados neste ambiente. Regras heurísticas de funcionalidades sensíveis e severidades são triagem e podem gerar falsos positivos; ausência de achados não comprova segurança.

Resultados de segurança incluem `sensitiveFeatures`, padrões reconhecidos com categoria e localização, além de IDs estáveis `risk-1`, `risk-2` etc. O painel do cenário permite associar `analysisId` e um ou mais IDs de risco. A análise é salva em `analisesSeguranca`; cenários armazenam `riskAssessment`. A listagem deriva prioridade pela severidade associada; cenários sem associação recebem `sem_avaliacao`.

As sugestões ficam em `testes/{testId}/sugestoesSeguranca/{suggestionId}` e guardam o risco e a análise de origem, rascunho revisável, estado, datas e ID do cenário criado após aceite. O cenário aceito registra `origemCriacao: "sugestao_automatica"`, o ID da sugestão e a análise de origem. O ID da análise aparece no relatório visual e também no JSON exportado. A geração é idempotente por par análise/risco. O painel permite editar os passos antes do aceite e descartar sugestões pendentes.

## Solução de problemas

- **`Configure FIREBASE_PROJECT_ID`:** copie um dos exemplos de `.env` para `backend\.env` e informe o ID do projeto.
- **Falha de autenticação na nuvem:** confira o caminho de `GOOGLE_APPLICATION_CREDENTIALS` e as permissões da conta de serviço. Não inclua o JSON no repositório.
- **Firestore não encontrado:** habilite o banco no Firebase Console. Confirme que o ID configurado é o do mesmo projeto.
- **Emulador indisponível:** deixe `npm run emulator` aberto, confira Java e a porta `8080`.
- **Erro de CORS:** confira `CORS_ORIGIN` e `VITE_API_URL`; reinicie os servidores após editar `.env`.
- **Porta ocupada:** altere `PORT` e `VITE_API_URL` de modo coerente.

## Escopo da Sprint 1

TES-32, TES-33, TES-34, TES-35, TES-36, TES-37 e TES-2 continuam cobertas. A infraestrutura TES-31 foi **adaptada para Firestore**, conforme a solicitação posterior, e já não cumpre a exigência original de PostgreSQL/Prisma. Nenhum status do Jira é alterado por este projeto.

## Escopo da Sprint 2

TES-54, TES-55, TES-56, TES-60, TES-61, TES-62, TES-17 e TES-15. A execução é manual, sem análise automática, dashboard ou autenticação completa. Nenhum status do Jira é alterado automaticamente.

## Escopo da Sprint 3

TES-66, TES-94, TES-70, TES-71, TES-67, TES-6, TES-68 e TES-7. O código fonte não é persistido; metadados e resultados são salvos em Firestore. O modo Docker é o padrão da API. O modo `process-dev` continua sem sandbox e serve apenas para desenvolvimento/testes locais. Nenhum status do Jira é alterado automaticamente.
