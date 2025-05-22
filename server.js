// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Campeonatos requisitados
const leagueIds = [
  73,   // Copa do Brasil
  72,   // Série B
  13,   // Libertadores
  71,   // Série A
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A Italiana
  128,  // Saudi Pro League
  291,  // UAE Pro League
  94,   // Primeira Liga Portugal
  196,  // Sul-Africano
  88,   // Eredivisie
  348,  // Campeonato Eslovaco
  106,  // Playoffs Holanda
  977,  // Segunda Liga Francesa - Playoffs
  5     // FA Cup
];

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

      const fixtures = fixtureRes.data.response;

      for (const match of fixtures) {
        const fixtureId = match.fixture.id;
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;
        const matchLeagueId = match.league.id;

        const homeStats = await getTeamStats(apiKey, homeId);
        const awayStats = await getTeamStats(apiKey, awayId);
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
          last5Matches: { home: homeLast5, away: awayLast5 }
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

async function getTeamStats(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = res.data.response;
    let totalShots = 0, totalShotsOn = 0, totalCorners = 0, totalCards = 0;
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
        const get = (type) => stats.statistics.find(s => s.type.includes(type))?.value ?? 0;

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
      cards: (totalCards / count).toFixed(1)
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

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
