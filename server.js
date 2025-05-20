const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const jogosManuais = [
  { home: 'Vasco da Gama', away: 'Operario-PR' },
  { home: 'Gremio', away: 'CSA' },
  { home: 'Manchester United', away: 'Bournemouth' },
  { home: 'Nautico', away: 'Sao Paulo' },
  { home: 'Athletico Paranaense', away: 'Brusque' },
  { home: 'Crystal Palace', away: 'Wolves' }
];

const season = 2024;
const date = '2025-05-20';

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const finalGames = [];

  try {
    const resAPI = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${date}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = resAPI.data.response;

    const jogosSelecionados = fixtures.filter(match =>
      jogosManuais.some(j => match.teams.home.name.includes(j.home) && match.teams.away.name.includes(j.away))
    );

    for (const match of jogosSelecionados) {
      const fixtureId = match.fixture.id;
      const homeId = match.teams.home.id;
      const awayId = match.teams.away.id;
      const leagueId = match.league.id;

      const homeStats = await getTeamStats(apiKey, homeId, leagueId);
      const awayStats = await getTeamStats(apiKey, awayId, leagueId);
      const homeLast5 = await getLastMatches(apiKey, homeId);
      const awayLast5 = await getLastMatches(apiKey, awayId);
      const prediction = await getPrediction(apiKey, fixtureId);
      const standings = await getStandings(apiKey, leagueId);
      const odds = await getOdds(apiKey, fixtureId);

      finalGames.push({
        fixtureId,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        homeLogo: match.teams.home.logo,
        awayLogo: match.teams.away.logo,
        time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit'
        }),
        stats: { home: homeStats, away: awayStats },
        last5Matches: { home: homeLast5, away: awayLast5 },
        prediction,
        standings,
        odds,
        recommendation: gerarRecomendacao(homeStats, awayStats)
      });
    }

    res.json(finalGames.length > 0 ? finalGames : []);
  } catch (err) {
    console.error('Erro geral:', err.message);
    res.json([]);
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function gerarRecomendacao(home, away) {
  if (home.goalsFor > 2 || away.goalsFor > 2) return '🔥 Over 2.5 gols';
  if (home.shotsOn >= 5 && away.shotsOn >= 5) return '⚡ Ambas marcam';
  if (home.corners >= 5 && away.corners >= 5) return '🏁 Over escanteios';
  return '❌ Sem sugestão clara';
}

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=${season}&league=${leagueId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const stats = res.data.response;
    const manual = await calculateStatsFromLastGames(apiKey, teamId);

    return {
      goalsFor: stats.goals?.for?.average?.total ?? manual.goalsFor,
      goalsAgainst: stats.goals?.against?.average?.total ?? manual.goalsAgainst,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch {
    return await calculateStatsFromLastGames(apiKey, teamId);
  }
}

async function calculateStatsFromLastGames(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = res.data.response;
    let statsSum = { goalsFor: 0, goalsAgainst: 0, shots: 0, shotsOn: 0, corners: 0 };
    let count = 0;

    for (const match of fixtures) {
      await delay(300);
      const statsRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${match.fixture.id}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const stats = statsRes.data.response.find(s => s.team.id === teamId);
      if (stats) {
        const findValue = type =>
          stats.statistics.find(s =>
            ['Total Shots', 'Shots on Goal', 'Corner Kicks', 'Corners'].includes(s.type) &&
            s.type.includes(type)
          )?.value ?? 0;

        statsSum.shots += findValue('Shots');
        statsSum.shotsOn += findValue('Shots on Goal');
        statsSum.corners += findValue('Corner');
        statsSum.goalsFor += match.teams.home.id === teamId ? match.goals.home : match.goals.away;
        statsSum.goalsAgainst += match.teams.home.id !== teamId ? match.goals.home : match.goals.away;
        count++;
      }
    }

    return {
      goalsFor: (statsSum.goalsFor / count).toFixed(1),
      goalsAgainst: (statsSum.goalsAgainst / count).toFixed(1),
      shots: (statsSum.shots / count).toFixed(1),
      shotsOn: (statsSum.shotsOn / count).toFixed(1),
      corners: (statsSum.corners / count).toFixed(1),
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch {
    return { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' };
  }
}

async function getLastMatches(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    return res.data.response.map(match => ({
      date: new Date(match.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeGoals: match.goals.home,
      awayGoals: match.goals.away,
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora'
    }));
  } catch {
    return [];
  }
}

async function getPrediction(apiKey, fixtureId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/predictions?fixture=${fixtureId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });
    const pred = res.data.response?.[0];
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

async function getStandings(apiKey, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=${season}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });
    return res.data.response?.[0]?.league?.standings?.[0] ?? [];
  } catch {
    return [];
  }
}

async function getOdds(apiKey, fixtureId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/odds?fixture=${fixtureId}&bookmaker=6`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const bets = res.data.response?.[0]?.bookmakers?.[0]?.bets ?? [];
    const odds = {};
    for (const bet of bets) {
      if (bet.name === 'Match Winner') {
        bet.values.forEach(v => {
          if (v.value === 'Home') odds.home = v.odd;
          if (v.value === 'Draw') odds.draw = v.odd;
          if (v.value === 'Away') odds.away = v.odd;
        });
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