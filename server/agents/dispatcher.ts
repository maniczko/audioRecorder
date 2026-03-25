import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Octokit } from 'octokit';

// 1. Definicja stanu (State)
const DispatcherState = Annotation.Root({
  task: Annotation<string>(),
  assignedAgent: Annotation<string>(),
  result: Annotation<string>(),
  error: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

// 2. Narzędzia GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// 3. Router Node
const routeTask = async (state: typeof DispatcherState.State) => {
  const routerModel = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
  });

  const SYSTEM_PROMPT = `Jesteś dyspozytorem zadań. Zawsze zwracasz TYLKO jedno słowo.
Twój cel to wybrać idealnego agenta do zadania zapisanego przez użytkownika.
Zasady wyboru (dokładnie te słowa):
- "github" - wybierz to ZAWSZE, jeśli zadanie wspomina o: repozytorium, kodzie na githubie, sprawdzaniu plików w repo, "audiorecorder".
- "claude" - dla architektury i pisania ciężkiego kodu lokalnie.
- "gemini" - dla analiz czytania obrazów/dokumentów.
- "groq" - dla małych operacji na tekście (np. policz do 10).
- "gpt" - w każdym innym przypadku.

Zwróć TYLKO jedno słowo: gemini, github, claude, gpt lub groq.`;

  const response = await routerModel.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(state.task),
  ]);

  const assigned = response.content.toString().toLowerCase().trim();
  const validAgents = ['github', 'claude', 'gpt', 'groq', 'gemini'];
  // Dodatkowe zabezpieczenie: jeśli użytkownik pisze o repozytorium, wymuś GitHub (czasem router się myli)
  const finalAgent =
    state.task.toLowerCase().includes('repozytorium') || state.task.toLowerCase().includes('github')
      ? 'github'
      : validAgents.includes(assigned)
        ? assigned
        : 'gpt';

  return { assignedAgent: finalAgent, messages: [response], error: '' };
};

// 4. Agent Nodes (Bezpieczne wywołania)
const handleGemini = async (state: typeof DispatcherState.State) => {
  try {
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-1.5-flash' });
    const response = await model.invoke([new HumanMessage(state.task)]);
    return { result: response.content.toString(), messages: [response], error: '' };
  } catch (err: any) {
    return { error: `Gemini Error: ${err.message}` };
  }
};

const handleClaude = async (state: typeof DispatcherState.State) => {
  try {
    const model = new ChatAnthropic({ model: 'claude-3-5-sonnet-20241022' });
    const response = await model.invoke([new HumanMessage(state.task)]);
    return { result: response.content.toString(), messages: [response], error: '' };
  } catch (err: any) {
    return { error: `Claude Error: ${err.message}` };
  }
};

const handleGroq = async (state: typeof DispatcherState.State) => {
  try {
    const model = new ChatGroq({ model: 'llama-3.1-8b-instant' });
    const response = await model.invoke([new HumanMessage(state.task)]);
    return { result: response.content.toString(), messages: [response], error: '' };
  } catch (err: any) {
    return { error: `Groq Error: ${err.message}` };
  }
};

const handleGithub = async (state: typeof DispatcherState.State) => {
  try {
    const rawModel = new ChatOpenAI({ modelName: 'gpt-4o', temperature: 0 });

    // Dodajemy narzędzie do odczytu repozytorium za pomocą bindTools
    const modelWithTools = rawModel.bindTools([
      {
        type: 'function',
        function: {
          name: 'github_read_repo',
          description: 'Pobiera listę plików w repozytorium GitHub',
          parameters: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: "Właściciel repoztyroium (np. 'maniczko')" },
              repo: { type: 'string', description: "Nazwa repozytorium (np. 'audioRecorder')" },
            },
            required: ['owner', 'repo'],
          },
        },
      },
    ]);

    const res1 = await modelWithTools.invoke([
      new SystemMessage(
        'Jesteś inteligentnym ekspertem od GitHuba. ' +
          'UWAGA: Twoim domyślnym kontekstem jest projekt użytkownika. ZAWSZE zakładaj ' +
          "że właściciel (owner) to 'maniczko', a repozytorium (repo) to 'audioRecorder'. " +
          "NIE pytaj o to użytkownika. Jeśli wspomni o 'audiorecorder', od razu wywołaj narzędzie 'github_read_repo' z odpowiednimi argumentami (owner='maniczko', repo='audioRecorder')."
      ),
      new HumanMessage(state.task),
    ]);

    // Sprawdzamy, czy model zdecydował się użyć narzędzia
    if (res1.tool_calls && res1.tool_calls.length > 0) {
      const toolCall = res1.tool_calls[0];
      const { owner, repo } = toolCall.args;

      console.log(`[Github Agent] Calling GitHub API for ${owner}/${repo}...`);

      const { data } = await octokit.rest.repos.getContent({ owner, repo, path: '' });
      const files = Array.isArray(data)
        ? data.map((f: any) => f.name).join(', ')
        : 'To nie jest katalog';

      // Drugie zapytanie - dajemy modelowi wynik z GitHuba
      const finalRes = await rawModel.invoke([
        new HumanMessage(state.task),
        new SystemMessage(
          `System pobrał wynik z GitHuba. W repozytorium ${owner}/${repo} znajdują się następujące pliki: ${files}. Odpowiedz użytkownikowi na jego pytanie. Jeśli pytał o ilość - policz je.`
        ),
      ]);
      return { result: finalRes.content.toString(), messages: [finalRes], error: '' };
    }

    // Jeśli nie użył narzędzia
    return { result: res1.content.toString(), messages: [res1], error: '' };
  } catch (err: any) {
    console.error('[Github Agent] Błąd GitHub:', err);
    return { error: `Github Error: ${err.message}` };
  }
};

const handleGpt = async (state: typeof DispatcherState.State) => {
  const model = new ChatOpenAI({ modelName: 'gpt-4o' });
  const response = await model.invoke([
    new SystemMessage(
      state.error
        ? `BACKUP MODE: Poprzedni agent zawiódł (${state.error}).`
        : 'Jesteś asystentem AI.'
    ),
    new HumanMessage(state.task),
  ]);
  return { result: response.content.toString(), messages: [response], error: '' };
};

// 5. Budowanie Grafu
const workflow = new StateGraph(DispatcherState)
  .addNode('router', routeTask)
  .addNode('gemini_agent', handleGemini)
  .addNode('github_agent', handleGithub)
  .addNode('claude_agent', handleClaude)
  .addNode('gpt_agent', handleGpt)
  .addNode('groq_agent', handleGroq)

  .addEdge(START, 'router')
  .addConditionalEdges('router', (state) => state.assignedAgent, {
    gemini: 'gemini_agent',
    github: 'github_agent',
    claude: 'claude_agent',
    gpt: 'gpt_agent',
    groq: 'groq_agent',
  })

  // Logika Fallback: jeśli błąd -> idź do gpt_agent, jeśli sukces -> koniec
  .addConditionalEdges('gemini_agent', (state) => (state.error ? 'fallback' : 'end'), {
    fallback: 'gpt_agent',
    end: END,
  })
  .addConditionalEdges('github_agent', (state) => (state.error ? 'fallback' : 'end'), {
    fallback: 'gpt_agent',
    end: END,
  })
  .addConditionalEdges('claude_agent', (state) => (state.error ? 'fallback' : 'end'), {
    fallback: 'gpt_agent',
    end: END,
  })
  .addConditionalEdges('groq_agent', (state) => (state.error ? 'fallback' : 'end'), {
    fallback: 'gpt_agent',
    end: END,
  })

  .addEdge('gpt_agent', END);

export const graph = workflow.compile();
