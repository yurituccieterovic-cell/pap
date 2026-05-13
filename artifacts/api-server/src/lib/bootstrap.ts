import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, nodesTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_PASSWORD = "pap";

const DEFAULT_HASH =
  "$2b$12$8OdQV60JYXR7K7s9VRFdpe5Jmo79/RFuyUvjcK7WZNMWV11emVvMy";

const SEED_USERS = [
  { login: "guest", passwordHash: DEFAULT_HASH, tier: 0, name: "Visitante" },
  { login: "aluno1", passwordHash: DEFAULT_HASH, tier: 1, name: "Aluno I" },
  { login: "aluno2", passwordHash: DEFAULT_HASH, tier: 2, name: "Aluno II" },
  { login: "aluno3", passwordHash: DEFAULT_HASH, tier: 3, name: "Aluno III" },
  { login: "aluno4", passwordHash: DEFAULT_HASH, tier: 4, name: "Aluno IV" },
  { login: "dev", passwordHash: DEFAULT_HASH, tier: 5, name: "Dev" },
];

const SEED_NODES = [
  { code: "0", title: "Conhecimento Humano", abbreviation: "CH", subtitle: "A raiz de todo saber humano", content: "O conhecimento humano se ramifica em ciências, empirismo, filosofia e religiões.", parentCode: null, level: 0, sortOrder: 0 },
  { code: "1", title: "Ciências", abbreviation: "Ciênc", subtitle: "O conhecimento científico sistematizado", content: "Área central do PAP, com todo o conteúdo exigido pela FUVEST 2026.", parentCode: "0", level: 1, sortOrder: 1 },
  { code: "E", title: "Empirismo", abbreviation: "Emp", subtitle: "O conhecimento pela experiência", content: "Corrente filosófica que defende a experiência como fonte do conhecimento.", parentCode: "0", level: 1, sortOrder: 2 },
  { code: "F", title: "Filosofia", abbreviation: "Fil", subtitle: "O amor ao saber", content: "Reflexão racional sobre a existência, o conhecimento e a moral.", parentCode: "0", level: 1, sortOrder: 3 },
  { code: "R", title: "Religiões", abbreviation: "Rel", subtitle: "O sagrado e o transcendente", content: "Sistemas de crenças e práticas relacionadas ao sagrado.", parentCode: "0", level: 1, sortOrder: 4 },
  { code: "11", title: "Ciências Humanas e Sociais Aplicadas", abbreviation: "CHS", subtitle: "Macroárea FUVEST 2026", content: "Compreensão das sociedades humanas ao longo do tempo e do espaço.", parentCode: "1", level: 2, sortOrder: 1 },
  { code: "12", title: "Matemática e suas Tecnologias", abbreviation: "Mat", subtitle: "Macroárea FUVEST 2026", content: "Raciocínio lógico, quantitativo e espacial aplicado a problemas reais.", parentCode: "1", level: 2, sortOrder: 2 },
  { code: "13", title: "Ciências da Natureza e suas Tecnologias", abbreviation: "CNT", subtitle: "Macroárea FUVEST 2026", content: "Biologia, Física e Química e suas relações com o mundo natural.", parentCode: "1", level: 2, sortOrder: 3 },
  { code: "14", title: "Linguagens e suas Tecnologias", abbreviation: "Ling", subtitle: "Macroárea FUVEST 2026", content: "Língua Portuguesa, Inglesa, Arte e Educação Física.", parentCode: "1", level: 2, sortOrder: 4 },
  { code: "111", title: "História", abbreviation: "Hist", subtitle: "A trajetória da humanidade", content: "Estudo dos processos históricos do Brasil e do mundo.", parentCode: "11", level: 3, sortOrder: 1 },
  { code: "121", title: "Matemática", abbreviation: "Mat", subtitle: "Números, formas e padrões", content: "Álgebra, geometria, probabilidade e estatística.", parentCode: "12", level: 3, sortOrder: 1 },
  { code: "131", title: "Biologia", abbreviation: "Bio", subtitle: "A ciência da vida", content: "Citologia, genética, ecologia, fisiologia e evolução.", parentCode: "13", level: 3, sortOrder: 1 },
  { code: "141", title: "Língua Portuguesa", abbreviation: "LP", subtitle: "Gramática, literatura e redação", content: "Compreensão, produção textual e literatura brasileira.", parentCode: "14", level: 3, sortOrder: 1 },
  { code: "112", title: "Geografia", abbreviation: "Geo", subtitle: "O espaço geográfico", content: "Análise do espaço físico, humano e geopolítico.", parentCode: "11", level: 3, sortOrder: 2 },
  { code: "132", title: "Física", abbreviation: "Fís", subtitle: "As leis do universo", content: "Mecânica, eletromagnetismo, termodinâmica e ondas.", parentCode: "13", level: 3, sortOrder: 2 },
  { code: "142", title: "Língua Inglesa", abbreviation: "Ing", subtitle: "Compreensão de textos em inglês", content: "Leitura e interpretação de textos em língua inglesa.", parentCode: "14", level: 3, sortOrder: 2 },
  { code: "113", title: "Filosofia", abbreviation: "Fil", subtitle: "Pensamento crítico e racional", content: "Ética, política, epistemologia e história da filosofia.", parentCode: "11", level: 3, sortOrder: 3 },
  { code: "133", title: "Química", abbreviation: "Quím", subtitle: "A matéria e suas transformações", content: "Química geral, inorgânica, orgânica e físico-química.", parentCode: "13", level: 3, sortOrder: 3 },
  { code: "143", title: "Arte", abbreviation: "Art", subtitle: "Linguagens artísticas", content: "Artes visuais, música, teatro e dança.", parentCode: "14", level: 3, sortOrder: 3 },
  { code: "114", title: "Sociologia", abbreviation: "Soc", subtitle: "A ciência da sociedade", content: "Análise das estruturas e dinâmicas sociais.", parentCode: "11", level: 3, sortOrder: 4 },
  { code: "144", title: "Educação Física", abbreviation: "EF", subtitle: "Práticas corporais e cultura", content: "Esportes, danças, lutas e ginásticas como patrimônio cultural.", parentCode: "14", level: 3, sortOrder: 4 },
  { code: "1111", title: "História Geral", abbreviation: "HG", subtitle: "Do mundo antigo ao contemporâneo", content: "Antiguidade, Idade Média, Moderna e Contemporânea.", parentCode: "111", level: 4, sortOrder: 1 },
  { code: "1121", title: "Geografia Física", abbreviation: "GF", subtitle: "O meio natural", content: "Geomorfologia, climatologia, hidrografia e biogeografia.", parentCode: "112", level: 4, sortOrder: 1 },
  { code: "1211", title: "Álgebra", abbreviation: "Álg", subtitle: "Equações e funções", content: "Equações, inequações, funções e progressões.", parentCode: "121", level: 4, sortOrder: 1 },
  { code: "1311", title: "Citologia e Histologia", abbreviation: "CiH", subtitle: "A célula e os tecidos", content: "Estrutura celular, divisão celular e tecidos humanos.", parentCode: "131", level: 4, sortOrder: 1 },
  { code: "1321", title: "Mecânica", abbreviation: "Mec", subtitle: "Movimento e forças", content: "Cinemática, dinâmica, leis de Newton, energia e trabalho.", parentCode: "132", level: 4, sortOrder: 1 },
  { code: "1331", title: "Química Geral e Inorgânica", abbreviation: "QG", subtitle: "Tabela periódica e reações", content: "Estrutura atômica, ligações químicas, reações inorgânicas.", parentCode: "133", level: 4, sortOrder: 1 },
  { code: "1411", title: "Gramática", abbreviation: "Gram", subtitle: "Estrutura da língua", content: "Morfologia, sintaxe, ortografia e concordância.", parentCode: "141", level: 4, sortOrder: 1 },
  { code: "1421", title: "Compreensão de Texto", abbreviation: "CT", subtitle: "Leitura em língua inglesa", content: "Gêneros textuais, vocabulário e interpretação em inglês.", parentCode: "142", level: 4, sortOrder: 1 },
  { code: "1431", title: "Linguagens Artísticas", abbreviation: "LA", subtitle: "Artes visuais, música, teatro e dança", content: "Elementos das linguagens artísticas e patrimônio cultural.", parentCode: "143", level: 4, sortOrder: 1 },
  { code: "1441", title: "Práticas Corporais", abbreviation: "PC", subtitle: "Esportes, danças e lutas", content: "Cultura corporal, esportes, lutas, danças e ginásticas.", parentCode: "144", level: 4, sortOrder: 1 },
  { code: "1112", title: "História do Brasil", abbreviation: "HB", subtitle: "Da colonização à república", content: "Brasil Colônia, Império e República.", parentCode: "111", level: 4, sortOrder: 2 },
  { code: "1122", title: "Geopolítica", abbreviation: "Gpl", subtitle: "Espaço e poder", content: "Globalização, blocos econômicos, conflitos e geopolítica mundial.", parentCode: "112", level: 4, sortOrder: 2 },
  { code: "1212", title: "Geometria", abbreviation: "Geom", subtitle: "Formas e espaço", content: "Geometria plana, espacial e analítica.", parentCode: "121", level: 4, sortOrder: 2 },
  { code: "1312", title: "Genética e Evolução", abbreviation: "GE", subtitle: "Hereditariedade e mudança", content: "Leis de Mendel, DNA, mutações e teorias evolutivas.", parentCode: "131", level: 4, sortOrder: 2 },
  { code: "1322", title: "Eletromagnetismo", abbreviation: "Ele", subtitle: "Eletricidade e magnetismo", content: "Eletrostática, eletrodinâmica, magnetismo e ondas eletromagnéticas.", parentCode: "132", level: 4, sortOrder: 2 },
  { code: "1332", title: "Química Orgânica", abbreviation: "QO", subtitle: "Compostos do carbono", content: "Hidrocarbonetos, funções orgânicas e reações.", parentCode: "133", level: 4, sortOrder: 2 },
  { code: "1412", title: "Literatura Brasileira", abbreviation: "Lit", subtitle: "As escolas literárias", content: "Do Quinhentismo ao Modernismo — autores, obras e estilos.", parentCode: "141", level: 4, sortOrder: 2 },
  { code: "1213", title: "Probabilidade e Estatística", abbreviation: "PE", subtitle: "Incerteza e dados", content: "Análise combinatória, probabilidade e estatística descritiva.", parentCode: "121", level: 4, sortOrder: 3 },
  { code: "1313", title: "Ecologia", abbreviation: "Eco", subtitle: "Relações entre seres e ambiente", content: "Cadeias alimentares, biomas, ciclos biogeoquímicos.", parentCode: "131", level: 4, sortOrder: 3 },
  { code: "1323", title: "Termodinâmica e Ondas", abbreviation: "TO", subtitle: "Calor, som e luz", content: "Temperatura, calor, leis da termodinâmica, ondas mecânicas e óptica.", parentCode: "132", level: 4, sortOrder: 3 },
  { code: "1333", title: "Físico-Química", abbreviation: "FQ", subtitle: "Grandezas e equilíbrio", content: "Estequiometria, termoquímica, cinética e equilíbrio químico.", parentCode: "133", level: 4, sortOrder: 3 },
  { code: "1413", title: "Redação", abbreviation: "Red", subtitle: "Produção textual argumentativa", content: "Dissertação-argumentativa, coesão, coerência e argumentação.", parentCode: "141", level: 4, sortOrder: 3 },
  { code: "1314", title: "Fisiologia Humana", abbreviation: "Fis", subtitle: "O funcionamento do corpo", content: "Sistemas digestivo, circulatório, nervoso e endócrino.", parentCode: "131", level: 4, sortOrder: 4 },
  { code: "11111", title: "Antiguidade e Medievalismo", abbreviation: "AM", subtitle: "Grécia, Roma e Idade Média", content: "Civilizações antigas, feudalismo e formação da Europa medieval.", parentCode: "1111", level: 5, sortOrder: 1 },
  { code: "11121", title: "Brasil Colonial", abbreviation: "BC", subtitle: "1500 a 1822", content: "Colonização portuguesa, ciclos econômicos e independência.", parentCode: "1112", level: 5, sortOrder: 1 },
  { code: "12111", title: "Equações e Inequações", abbreviation: "EI", subtitle: "1º e 2º grau", content: "Equações lineares, quadráticas, sistemas e inequações.", parentCode: "1211", level: 5, sortOrder: 1 },
  { code: "12121", title: "Geometria Plana", abbreviation: "GP", subtitle: "Figuras em 2D", content: "Triângulos, quadriláteros, círculos, área e perímetro.", parentCode: "1212", level: 5, sortOrder: 1 },
  { code: "14111", title: "Morfologia", abbreviation: "Morf", subtitle: "Classes de palavras", content: "Substantivo, adjetivo, verbo, pronome, advérbio e suas flexões.", parentCode: "1411", level: 5, sortOrder: 1 },
  { code: "14121", title: "Quinhentismo ao Arcadismo", abbreviation: "QA", subtitle: "Séculos XVI–XVIII", content: "Literatura de informação, barroco e arcadismo brasileiro.", parentCode: "1412", level: 5, sortOrder: 1 },
  { code: "11112", title: "Mundo Moderno e Contemporâneo", abbreviation: "MMC", subtitle: "Renascimento ao século XXI", content: "Grandes navegações, revoluções, guerras mundiais e globalização.", parentCode: "1111", level: 5, sortOrder: 2 },
  { code: "11122", title: "Brasil Republicano", abbreviation: "BR", subtitle: "1889 ao presente", content: "Primeira República, Era Vargas, ditadura militar e redemocratização.", parentCode: "1112", level: 5, sortOrder: 2 },
  { code: "12112", title: "Funções", abbreviation: "Fun", subtitle: "Relações entre grandezas", content: "Função afim, quadrática, exponencial e logarítmica.", parentCode: "1211", level: 5, sortOrder: 2 },
  { code: "12122", title: "Geometria Espacial", abbreviation: "GEs", subtitle: "Sólidos em 3D", content: "Prismas, pirâmides, cilindros, cones e esferas.", parentCode: "1212", level: 5, sortOrder: 2 },
  { code: "14112", title: "Sintaxe", abbreviation: "Sint", subtitle: "Estrutura das frases", content: "Sujeito, predicado, complementos, período composto e concordância.", parentCode: "1411", level: 5, sortOrder: 2 },
  { code: "14122", title: "Romantismo ao Modernismo", abbreviation: "RM", subtitle: "Séculos XIX–XX", content: "Romantismo, realismo, parnasianismo, simbolismo e modernismo.", parentCode: "1412", level: 5, sortOrder: 2 },
  { code: "12113", title: "Progressões", abbreviation: "Prog", subtitle: "PA e PG", content: "Progressão aritmética e geométrica, somas e termos gerais.", parentCode: "1211", level: 5, sortOrder: 3 },
];

/**
 * Seeds nodes and users tables if they are empty.
 * Runs on every startup but skips if data already exists.
 */
export async function seedDatabase(): Promise<void> {
  const existingNodes = await db.select({ code: nodesTable.code }).from(nodesTable).limit(1);
  if (existingNodes.length === 0) {
    logger.info("bootstrap: nodes table empty — seeding 57 FUVEST 2026 nodes");
    await db.insert(nodesTable).values(SEED_NODES);
    logger.info("bootstrap: nodes seeded OK");
  } else {
    logger.info("bootstrap: nodes table already populated — skipping seed");
  }

  const existingUsers = await db.select({ login: usersTable.login }).from(usersTable).limit(1);
  if (existingUsers.length === 0) {
    logger.info("bootstrap: users table empty — seeding default accounts");
    await db.insert(usersTable).values(SEED_USERS);
    logger.info("bootstrap: users seeded OK (password for all accounts: pap)");
    logger.warn(
      "bootstrap: default accounts use shared password 'pap'. " +
        "Run `pnpm --filter @workspace/scripts run randomize-passwords` to assign unique passwords."
    );
  } else {
    logger.info("bootstrap: users table already populated — skipping seed");
  }
}

/**
 * Checks all built-in user accounts for the known default shared password.
 * If any account is found still using that password the server logs a warning.
 * In production, this is a non-fatal warning — the app still starts.
 */
export async function enforceUniquePasswords(): Promise<void> {
  if (process.env["NODE_ENV"] !== "production") {
    logger.info("bootstrap: password uniqueness check skipped in non-production environment");
    return;
  }

  const users = await db.select().from(usersTable);

  const affected: string[] = [];

  for (const user of users) {
    if (!user.passwordHash || user.passwordHash.length === 0) {
      continue;
    }
    const isDefault = await bcrypt.compare(DEFAULT_PASSWORD, user.passwordHash);
    if (isDefault) {
      affected.push(user.login);
    }
  }

  if (affected.length === 0) {
    logger.info("bootstrap: all accounts have unique passwords — OK");
    return;
  }

  logger.warn(
    { accounts: affected },
    "bootstrap: one or more accounts still use the shared default password. " +
      "Run `pnpm --filter @workspace/scripts run randomize-passwords` to assign " +
      "unique passwords and capture the output securely, then restart the server."
  );
}
