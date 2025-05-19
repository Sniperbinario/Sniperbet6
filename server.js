// server.js SEM REDIS, com fallback por liga para sempre mostrar o que der

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135, 130]; // Série A, Série B, Libertadores, Premier League, La Liga, Serie A ITA, etc
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  for (const leagueId of leagueIds) {
    try {
      const fixtureRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const fixtures = fixtureRes.data.response.filter(f => f.fixture.status.short === "FT");

      for (const match of fixtures) {
        const fixtureId = match.fixture.id;
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;
        const matchLeagueId = match.league.id;

        const homeStats = await getTeamStats(apiKey, homeId, matchLeagueId);
        const awayStats = await getTeamStats(apiKey, awayId, matchLeagueId);
        const homeLast5 = await getLastMatches(apiKey, homeId);
        const awayLast5 = await getLastMatches(apiKey, awayId);

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
          recommendation: gerarRecomendacao(homeStats, awayStats),
          fallback: false
        });
      }
    } catch (err) {
      console.warn(`⚠️ Liga ${leagueId} falhou: ${err.message}`);
    }
  }

  res.json(finalGames);
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function gerarRecomendacao(home, away) {
  if (home.shots >= 10 && away.shots >= 10 && home.corners >= 4 && away.corners >= 4) {
    return '🏆 Aposta sugerida: Over escanteios';
  }
  if (home.goalsFor > 2 || away.goalsFor > 2) {
    return '🔥 Aposta sugerida: Over 2.5 gols';
  }
  if (home.shotsOn >= 5 && away.shotsOn >= 5) {
    return '💡 Aposta sugerida: Ambas marcam';
  }
  return '🤔 Não recomendado apostar';
}

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=2024&league=${leagueId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const stats = res.data.response;
    const manual = await calculateShotsAndCorners(apiKey, teamId);

    return {
      goalsFor: stats.goals?.for?.average?.total ?? 0,
      goalsAgainst: stats.goals?.against?.average?.total ?? 0,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch {
    const manual = await calculateShotsAndCorners(apiKey, teamId);
    return {
      goalsFor: 0,
      goalsAgainst: 0,
      shots: manual.shots,
      shotsOn: manual.shotsOn,
      corners: manual.corners,
      cards: 0
    };
  }
}

async function calculateShotsAndCorners(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = res.data.response;
    let totalShots = 0, totalShotsOn = 0, totalCorners = 0, count = 0;

    for (const match of fixtures) {
      await delay(300);
      const statsRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${match.fixture.id}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const stats = statsRes.data.response.find(e => e.team.id === teamId);
      if (stats) {
        const get = (type) => stats.statistics.find(s => ['Total Shots', 'Shots on Goal', 'Corner Kicks', 'Total corners'].includes(s.type) && s.type.includes(type))?.value ?? 0;
        totalShots += get('Shots');
        totalShotsOn += get('Shots on Goal');
        totalCorners += get('Corner');
        count++;
      }
    }

    return {
      shots: count ? (totalShots / count).toFixed(1) : '-',
      shotsOn: count ? (totalShotsOn / count).toFixed(1) : '-',
      corners: count ? (totalCorners / count).toFixed(1) : '-'
    };
  } catch {
    return { shots: '-', shotsOn: '-', corners: '-' };
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

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
