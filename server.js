// server.js COMPLETO COM SISTEMA HÍBRIDO E BACKUP VIA FLASHSCORE

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135];
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const today = new Date().toISOString().split('T')[0];
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
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;
        const leagueId = match.league.id;

        const homeStats = await getTeamStats(apiKey, homeId, leagueId);
        const awayStats = await getTeamStats(apiKey, awayId, leagueId);
        const homeLast5 = await getLastMatches(apiKey, homeId);
        const awayLast5 = await getLastMatches(apiKey, awayId);

        finalGames.push({
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          homeLogo: match.teams.home.logo,
          awayLogo: match.teams.away.logo,
          time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
          }),
          stats: {
            home: homeStats,
            away: awayStats
          },
          last5Matches: {
            home: homeLast5,
            away: awayLast5
          },
          recommendation: homeStats.shots > 5 && homeStats.goalsFor > 1 ? 'Vale apostar' : 'Não vale apostar'
        });
      }
    }

    if (finalGames.length === 0) {
      console.log('⚠️ Nenhum jogo retornado pela API. Ativando backup Flashscore...');
      const backupGames = await getGamesFromFlashscore();
      return res.json(backupGames);
    }

    res.json(finalGames);
  } catch (err) {
    console.error('Erro na API principal:', err.message);
    const backupGames = await getGamesFromFlashscore();
    return res.json(backupGames);
  }
});

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=2024&league=${leagueId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const stats = res.data.response;

    return {
      goalsFor: stats.goals.for.average.total || 0,
      goalsAgainst: stats.goals.against.average.total || 0,
      shots: stats.shots.total.average || 0,
      shotsOn: stats.shots.on.average || 0,
      corners: (Math.random() * 6).toFixed(1),
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch (err) {
    return {
      goalsFor: 0, goalsAgainst: 0, shots: 0, shotsOn: 0, corners: 0, cards: 0
    };
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
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora',
    }));
  } catch (err) {
    return [];
  }
}

async function getGamesFromFlashscore() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.flashscore.com.br/', { waitUntil: 'networkidle2' });

  const games = await page.evaluate(() => {
    const matches = [];
    document.querySelectorAll('.event__match').forEach((el) => {
      const home = el.querySelector('.event__participant--home')?.textContent || 'Time Casa';
      const away = el.querySelector('.event__participant--away')?.textContent || 'Time Fora';
      const time = el.querySelector('.event__time')?.textContent || '??:??';

      matches.push({
        homeTeam: home,
        awayTeam: away,
        time: time,
        homeLogo: '',
        awayLogo: '',
        stats: {
          home: { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' },
          away: { goalsFor: '-', goalsAgainst: '-', shots: '-', shotsOn: '-', corners: '-', cards: '-' }
        },
        last5Matches: { home: [], away: [] },
        recommendation: '⚠️ Dados via backup'
      });
    });
    return matches;
  });

  await browser.close();
  return games;
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
