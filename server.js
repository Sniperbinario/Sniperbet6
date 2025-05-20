const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135, 130];
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  try {
    for (const leagueId of leagueIds) {
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

        const prediction = await getPrediction(apiKey, fixtureId);
        const standings = await getStandings(apiKey, matchLeagueId);
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
  const totalGols = Number(home.goalsFor) + Number(away.goalsFor);
  const chutesAoGol = Number(home.shotsOn) + Number(away.shotsOn);
  const escanteios = Number(home.corners) + Number(away.corners);

  if (totalGols > 4) return '🔥 Aposta sugerida: Over 2.5 gols';
  if (chutesAoGol >= 10) return '💡 Aposta sugerida: Ambas marcam';
  if (escanteios >= 10) return '🏆 Aposta sugerida: Over escanteios';
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
      goalsFor: stats.goals?.for?.average?.total ?? manual.goalsFor,
      goalsAgainst: stats.goals?.against?.average?.total ?? manual.goalsAgainst,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch {
    const manual = await calculateShotsAndCorners(apiKey, teamId);
    return {
      goalsFor: manual.goalsFor,
      goalsAgainst: manual.goalsAgainst,
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
    let totalShots = 0, totalShotsOn = 0, totalCorners = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0;
    let count = 0;

    for (const match of fixtures) {
      await delay(300);
      totalGoalsFor += match.teams.home.id === teamId ? match.goals.home : match.goals.away;
      totalGoalsAgainst += match.teams.home.id === teamId ? match.goals.away : match.goals.home;

      const statsRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${match.fixture.id}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const stats = statsRes.data.response.find(e => e.team.id === teamId);
      if (stats) {
        const get = (type) => stats.statistics.find(s =>
          ['Total Shots', 'Shots on Goal', 'Corner Kicks', 'Total corners'].includes(s.type) && s.type.includes(type)
        )?.value ?? 0;

        totalShots += get('Shots');
        totalShotsOn += get('Shots on Goal');
        totalCorners += get('Corner');
        count++;
      }
    }

    return {
      goalsFor: (totalGoalsFor / count).toFixed(1),
      goalsAgainst: (totalGoalsAgainst / count).toFixed(1),
      shots: (totalShots / count).toFixed(1),
      shotsOn: (totalShotsOn / count).toFixed(1),
      corners: (totalCorners / count).toFixed(1)
    };
  } catch {
    return { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-' };
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
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=2024`, {
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
