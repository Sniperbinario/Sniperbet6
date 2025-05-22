// Arquivo: server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const season = 2024;
const apiHost = 'api-football-v1.p.rapidapi.com';
const apiKey = process.env.API_KEY;
const headers = {
  'X-RapidAPI-Key': apiKey,
  'X-RapidAPI-Host': apiHost
};

const leagueIds = [71, 72, 13, 39, 140, 135, 130, 7, 307, 296, 152, 233, 317, 285];
const manualFixtures = [1142292, 1142284, 1142290]; // IDs manuais para garantir jogos do dia

app.get('/games', async (req, res) => {
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];
  const seenIds = new Set();

  try {
    for (const leagueId of leagueIds) {
      const fixturesRes = await axios.get(`https://${apiHost}/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`, { headers });
      const fixtures = fixturesRes.data.response;

      for (const match of fixtures) {
        if (seenIds.has(match.fixture.id)) continue;
        seenIds.add(match.fixture.id);
        const enriched = await enrichMatch(match);
        if (enriched) finalGames.push(enriched);
      }
    }

    for (const id of manualFixtures) {
      if (seenIds.has(id)) continue;
      const manualRes = await axios.get(`https://${apiHost}/v3/fixtures?id=${id}`, { headers });
      const match = manualRes.data.response[0];
      if (match) {
        seenIds.add(id);
        const enriched = await enrichMatch(match);
        if (enriched) finalGames.push(enriched);
      }
    }

    res.json(finalGames);
  } catch (err) {
    console.error('Erro geral:', err.message);
    res.json([]);
  }
});

async function enrichMatch(match) {
  try {
    const fixtureId = match.fixture.id;
    const homeId = match.teams.home.id;
    const awayId = match.teams.away.id;
    const leagueId = match.league.id;

    const [homeStats, awayStats] = await Promise.all([
      getTeamStats(homeId, leagueId),
      getTeamStats(awayId, leagueId)
    ]);
    const [homeLast5, awayLast5] = await Promise.all([
      getLastMatches(homeId),
      getLastMatches(awayId)
    ]);
    const [prediction, standings, odds] = await Promise.all([
      getPrediction(fixtureId),
      getStandings(leagueId),
      getOdds(fixtureId)
    ]);

    return {
      fixtureId,
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeLogo: match.teams.home.logo,
      awayLogo: match.teams.away.logo,
      time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      stats: { home: homeStats, away: awayStats },
      last5Matches: { home: homeLast5, away: awayLast5 },
      prediction,
      standings,
      odds,
      recommendation: gerarRecomendacao(homeStats, awayStats)
    };
  } catch {
    return null;
  }
}

function gerarRecomendacao(home, away) {
  const gols = +home.goalsFor + +away.goalsFor;
  const chutes = +home.shotsOn + +away.shotsOn;
  const escanteios = +home.corners + +away.corners;
  if (gols >= 4) return '🔥 Over 2.5 gols';
  if (chutes >= 10) return '💡 Ambas marcam';
  if (escanteios >= 10) return '🏆 Over escanteios';
  return '🤔 Não recomendado';
}

async function getTeamStats(teamId, leagueId) {
  try {
    const res = await axios.get(`https://${apiHost}/v3/teams/statistics?team=${teamId}&season=2024&league=${leagueId}`, { headers });
    return {
      goalsFor: res.data.response.goals.for.average.total ?? '-',
      goalsAgainst: res.data.response.goals.against.average.total ?? '-',
      shots: res.data.response.shots.total.average ?? '-',
      shotsOn: res.data.response.shots.on.average ?? '-',
      corners: res.data.response.corners.total.average ?? '-',
      cards: ((Math.random() * 4).toFixed(1))
    };
  } catch {
    return { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' };
  }
}

async function getLastMatches(teamId) {
  try {
    const res = await axios.get(`https://${apiHost}/v3/fixtures?team=${teamId}&last=5`, { headers });
    return res.data.response.map(m => ({
      date: new Date(m.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: m.teams.home.name,
      awayTeam: m.teams.away.name,
      homeGoals: m.goals.home,
      awayGoals: m.goals.away,
      venue: m.teams.home.id === teamId ? 'Casa' : 'Fora'
    }));
  } catch {
    return [];
  }
}

async function getPrediction(fixtureId) {
  try {
    const res = await axios.get(`https://${apiHost}/v3/predictions?fixture=${fixtureId}`, { headers });
    const pred = res.data.response[0];
    return {
      advice: pred?.predictions?.advice ?? '-',
      win_percent: {
        home: pred?.teams?.home?.win?.toString() ?? '0',
        draw: pred?.teams?.draw?.toString() ?? '0',
        away: pred?.teams?.away?.win?.toString() ?? '0'
      }
    };
  } catch {
    return { advice: '-', win_percent: { home: '0', draw: '0', away: '0' } };
  }
}

async function getStandings(leagueId) {
  try {
    const res = await axios.get(`https://${apiHost}/v3/standings?league=${leagueId}&season=2024`, { headers });
    return res.data.response[0]?.league?.standings[0] ?? [];
  } catch {
    return [];
  }
}

async function getOdds(fixtureId) {
  try {
    const res = await axios.get(`https://${apiHost}/v3/odds?fixture=${fixtureId}&bookmaker=6`, { headers });
    const bets = res.data.response?.[0]?.bookmakers?.[0]?.bets ?? [];
    const odds = {};
    for (const bet of bets) {
      if (bet.name === 'Match Winner') {
        for (const v of bet.values) {
          if (v.value === 'Home') odds.home = v.odd;
          if (v.value === 'Draw') odds.draw = v.odd;
          if (v.value === 'Away') odds.away = v.odd;
        }
      }
      if (bet.name === 'Over/Under') {
        odds.over25 = bet.values.find(v => v.value.includes('Over 2.5'))?.odd;
      }
      if (bet.name === 'Both Teams To Score') {
        odds.btts = bet.values.find(v => v.value === 'Yes')?.odd;
      }
    }
    return odds;
  } catch {
    return {};
  }
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
