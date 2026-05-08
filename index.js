require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember]
});

const BOOSTER_ROLE_ID = "1502189719432335360";
const BOOST_CHANNEL_ID = "1502204195745562706";

const DATA_FILE = "./boostData.json";

const GRACE_PERIOD = 60 * 24 * 60 * 60 * 1000; // 60 days

let boostData = {};

// Load saved data
if (fs.existsSync(DATA_FILE)) {
  try {
    boostData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to load boostData.json");
    boostData = {};
  }
}

// Save helper
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(boostData, null, 2));
}

// Bot ready
client.once("clientReady", async () => {

  console.log(`Logged in as ${client.user.tag}`);

  // Sync current boosters on startup
  for (const guild of client.guilds.cache.values()) {

    await guild.members.fetch();

    for (const member of guild.members.cache.values()) {

      if (member.user.bot) continue;

      // User is boosting
      if (member.premiumSince) {

        // Give role if missing
        if (!member.roles.cache.has(BOOSTER_ROLE_ID)) {

          await member.roles
            .add(BOOSTER_ROLE_ID)
            .catch(console.error);

          console.log(
            `Added booster role to ${member.user.tag}`
          );
        }

        boostData[member.id] = {
          stoppedBoostingAt: null
        };
      }
    }
  }

  saveData();
});

// Detect boost changes
client.on("guildMemberUpdate", async (oldMember, newMember) => {

  const oldBoost = oldMember.premiumSince;
  const newBoost = newMember.premiumSince;

  // Started boosting
  if (!oldBoost && newBoost) {

    console.log(`${newMember.user.tag} started boosting`);

    // Give role
    await newMember.roles
      .add(BOOSTER_ROLE_ID)
      .catch(console.error);

    // Save data
    boostData[newMember.id] = {
      stoppedBoostingAt: null
    };

    saveData();

    // Boost announcement
    const boostChannel =
      newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);

    if (boostChannel) {

      const premiumTier =
        newMember.guild.premiumTier;

      const boostCount =
        newMember.guild.premiumSubscriptionCount;

      boostChannel.send(
        `🎉 ${newMember.user} just boosted the server!\n` +
        `✨ Server Level: ${premiumTier}\n` +
        `🚀 Total Boosts: ${boostCount}`
      );
    }
  }

  // Stopped boosting
  if (oldBoost && !newBoost) {

    console.log(`${newMember.user.tag} stopped boosting`);

    boostData[newMember.id] = {
      stoppedBoostingAt: Date.now()
    };

    saveData();
  }
});

// Grace period checker
setInterval(async () => {

  for (const guild of client.guilds.cache.values()) {

    for (const userId of Object.keys(boostData)) {

      const data = boostData[userId];

      if (!data.stoppedBoostingAt) continue;

      const member =
        await guild.members
          .fetch(userId)
          .catch(() => null);

      if (!member) continue;

      // User boosted again
      if (member.premiumSince) {

        boostData[userId].stoppedBoostingAt = null;

        if (!member.roles.cache.has(BOOSTER_ROLE_ID)) {

          await member.roles
            .add(BOOSTER_ROLE_ID)
            .catch(console.error);

          console.log(
            `Restored booster role to ${member.user.tag}`
          );
        }

        saveData();

        continue;
      }

      // Grace expired
      const expired =
        Date.now() - data.stoppedBoostingAt >
        GRACE_PERIOD;

      if (expired) {

        if (member.roles.cache.has(BOOSTER_ROLE_ID)) {

          await member.roles
            .remove(BOOSTER_ROLE_ID)
            .catch(console.error);

          console.log(
            `Removed booster role from ${member.user.tag}`
          );
        }

        delete boostData[userId];

        saveData();
      }
    }

  }

}, 60 * 60 * 1000);

// TEST COMMANDS
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  // Test add role
  if (message.content === "!testboost") {

    await message.member.roles
      .add(BOOSTER_ROLE_ID)
      .catch(console.error);

    message.reply(
      "✅ Booster role added."
    );

    console.log("Test booster role added");
  }

  // Test remove role
  if (message.content === "!removetestboost") {

    await message.member.roles
      .remove(BOOSTER_ROLE_ID)
      .catch(console.error);

    message.reply(
      "❌ Booster role removed."
    );

    console.log("Test booster role removed");
  }

});

client.login(process.env.TOKEN);