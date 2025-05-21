const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135, 130]; // Brasileirão A, B, Liberta, Premier, La Liga, Serie A ITA, Betano ARG
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  try {
    for (const leagueId of leagueIds) {
      const fixtureRes = await axios.get(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        }
      );

      const fixtures = fixtureRes.data.response; // sem filtro FT

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
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
          }),
          stats: { home: homeStats, away: awayStats },
          last5Matches: { home: homeLast5, away: awayLast5 },
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

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(
      `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=2024&league=${leagueId}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      }
    );

    const stats = res.data.response;
    const manual = await calculateStatsManualmente(apiKey, teamId);

    return {
      goalsFor: stats.goals?.for?.average?.total ?? manual.goalsFor,
      goalsAgainst: stats.goals?.against?.average?.total ?? manual.goalsAgainst,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: manual.cards,
    };
  } catch {
    const manual = await calculateStatsManualmente(apiKey, teamId);
    return {
      goalsFor: manual.goalsFor,
      goalsAgainst: manual.goalsAgainst,
      shots: manual.shots,
      shotsOn: manual.shotsOn,
      corners: manual.corners,
      cards: manual.cards,
    };
  }
}

async function calculateStatsManualmente(apiKey, teamId) {
  try {
    const res = await axios.get(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      }
    );

    const fixtures = res.data.response;
    let totalShots = 0,
      totalShotsOn = 0,
      totalCorners = 0,
      totalCards = 0,
      totalGoalsFor = 0,
      totalGoalsAgainst = 0,
      count = 0;

    for (const match of fixtures) {
      await delay(250);
      totalGoalsFor += match.teams.home.id === teamId ? match.goals.home : match.goals.away;
      totalGoalsAgainst += match.teams.home.id === teamId ? match.goals.away : match.goals.home;

      const statsRes = await axios.get(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${match.fixture.id}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        }
      );

      const stats = statsRes.data.response.find(s => s.team.id === teamId);
      if (stats) {
        const get = type => stats.statistics.find(s => s.type.includes(type))?.value ?? 0;

        totalShots += get('Total Shots');
        totalShotsOn += get('Shots on Goal');
        totalCorners += get('Corner');
        totalCards += get('Yellow Cards') + get('Red Cards');
        count++;
      }
    }

    return {
      goalsFor: (totalGoalsFor / count).toFixed(1),
      goalsAgainst: (totalGoalsAgainst / count).toFixed(1),
      shots: (totalShots / count).toFixed(1),
      shotsOn: (totalShotsOn / count).toFixed(1),
      corners: (totalCorners / count).toFixed(1),
      cards: (totalCards / count).toFixed(1),
    };
  } catch {
    return {
      goalsFor: '-',
      goalsAgainst: '-',
      shots: '-',
      shotsOn: '-',
      corners: '-',
      cards: '-',
    };
  }
}

async function getLastMatches(apiKey, teamId) {
  try {
    const res = await axios.get(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      }
    );

    return res.data.response.map(match => ({
      date: new Date(match.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeGoals: match.goals.home,
      awayGoals: match.goals.away,
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora',
    }));
  } catch {
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
