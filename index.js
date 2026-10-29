// ==========================================
// 1. IMPORTATION DES MODULES ET CONFIGURATION
// ==========================================

// Importation des classes nécessaires depuis la bibliothèque discord.js
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle 
} = require('discord.js');

// Module Node.js pour créer le mini serveur HTTP pour Render
const http = require('http');

// Chargement des variables d'environnement depuis le fichier .env
require('dotenv').config();

// ==========================================
// 2. INITIALISATION DU CLIENT DISCORD
// ==========================================

// Création de l'instance du bot avec les "Intents" (permissions d'accès aux données du serveur)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,          // Gestion des serveurs et des salons
        GatewayIntentBits.GuildMessages,    // Lecture des messages des salons
        GatewayIntentBits.GuildMembers,     // Récupération des membres et de leurs rôles
        GatewayIntentBits.DirectMessages    // Envoi de messages privés (DM) aux utilisateurs
    ]
});

// Récupération des IDs importants depuis les variables d'environnement ou définis en dur
const SALON_MANDAT_ID = process.env.SALON_MANDAT_ID; 
const SALON_ADMINISTRATIF_ID = '1565154284474204170'; // ID du salon pour les demandes administratives
const MAIRE_ROLE_ID = '1564029564206719098'; // ID du rôle du Maire (nécessaire pour valider/refuser)

// Tableau répertoriant la hiérarchie officielle de la Mairie (grades, IDs de rôles et salaires)
const HIERARCHIE_LISTE = [
    { name: '1 - Maire', roleId: MAIRE_ROLE_ID, salaire: '5600 €' },
    { name: '2 - Adjoint au maire', roleId: '1564029859406151860', salaire: '4200 €' },
    { name: '3 - Adjoint-administratif', roleId: '1565054663693176903', salaire: '3000 €' },
    { name: '4 - Directeur Sécurité', roleId: '1565027964838477864', salaire: '2000 €' },
    { name: '5 - Sécurité Rapprochée', roleId: '1564046541247877170', salaire: '1950 €' },
    { name: '6 - Chauffeur Privé', roleId: '1564046781824639006', salaire: '1950 €' },
    { name: '7 - Agent d\'accueil', roleId: '1565140513856815194', salaire: '1400 €' }
];

// ==========================================
// 3. ÉVÉNEMENT DE DÉMARRAGE ET ENREGISTREMENT DES COMMANDES
// ==========================================

// S'exécute une seule fois lorsque le bot est connecté et prêt
client.once('ready', async () => {
    console.log(`Bot connecté en tant que ${client.user.tag} avec succès !`);

    // Définition des commandes Slash (/) enregistrées auprès de l'API Discord
    const commands = [
        new SlashCommandBuilder()
            .setName('mandat')
            .setDescription('Créer une demande de mandat officielle pour la Mairie'),
        new SlashCommandBuilder()
            .setName('demande-administrative')
            .setDescription('Effectuer une demande administrative auprès de la Mairie'),
        new SlashCommandBuilder()
            .setName('hierarchie')
            .setDescription('Afficher l\'organigramme complet de la Mairie')
    ].map(command => command.toJSON());

    // Configuration de l'API REST de Discord pour enregistrer les commandes
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Enregistrement global des commandes sur l'application du bot
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Commandes slash (/) enregistrées avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes :', error);
    }
});

// ==========================================
// 4. GESTION DES INTERACTIONS (COMMANDES, BOUTONS, FORMULAIRES)
// ==========================================

client.on('interactionCreate', async interaction => {

    // --- CAS A : L'UTILISATEUR LANCE UNE COMMANDE SLASH (/) ---
    if (interaction.isChatInputCommand()) {
        
        // 1. Commande /mandat : Ouvre le formulaire de création de mandat
        if (interaction.commandName === 'mandat') {
            const modal = new ModalBuilder()
                .setCustomId('modalMandat')
                .setTitle('Demande de Mandat - Mairie');

            const categorieInput = new TextInputBuilder()
                .setCustomId('mandatCategorie')
                .setLabel('Type / Catégorie du mandat')
                .setPlaceholder('Ex: Perquisition / Mandat d\'arrêt')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('mandatDescription')
                .setLabel('Description des faits / motifs')
                .setPlaceholder('Détaillez les raisons de la demande...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const echeanceInput = new TextInputBuilder()
                .setCustomId('mandatEcheance')
                .setLabel('Pour quand ? (Date et Heure)')
                .setPlaceholder('Ex: 30/10/2026 à 21h00')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const signatureInput = new TextInputBuilder()
                .setCustomId('mandatSignature')
                .setLabel('Signature (Nom Prénom RP)')
                .setPlaceholder('Ex: Jean Dupont')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            // Ajout des champs au formulaire modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(categorieInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(echeanceInput),
                new ActionRowBuilder().addComponents(signatureInput)
            );

            await interaction.showModal(modal);
        } 
        
        // 2. Commande /demande-administrative : Ouvre le formulaire de demande administrative (vérifie d'abord le salon)
        else if (interaction.commandName === 'demande-administrative') {
            // Vérification si l'utilisateur est dans le bon salon autorisé
            if (interaction.channelId !== SALON_ADMINISTRATIF_ID) {
                return interaction.reply({ 
                    content: `❌ Vous ne pouvez utiliser cette commande que dans le salon <#${SALON_ADMINISTRATIF_ID}>.`, 
                    ephemeral: true 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modalAdministrative')
                .setTitle('Demande Administrative - Mairie');

            const typeDemandeInput = new TextInputBuilder()
                .setCustomId('adminType')
                .setLabel('Objet de la demande')
                .setPlaceholder('Ex: Subvention / Modification de commerce...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const detailsInput = new TextInputBuilder()
                .setCustomId('adminDetails')
                .setLabel('Détails et explications')
                .setPlaceholder('Expliquez votre requête en détail...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const identiteInput = new TextInputBuilder()
                .setCustomId('adminIdentite')
                .setLabel('Nom & Prénom RP du demandeur')
                .setPlaceholder('Ex: Marc Leroy')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(typeDemandeInput),
                new ActionRowBuilder().addComponents(detailsInput),
                new ActionRowBuilder().addComponents(identiteInput)
            );

            await interaction.showModal(modal);
        }

        // 3. Commande /hierarchie : Génère et affiche l'organigramme complet de la Mairie
        else if (interaction.commandName === 'hierarchie') {
            await interaction.deferReply(); // Met le bot en "réflexion" le temps de récupérer les membres

            try {
                // Récupération de tous les membres du serveur en cache
                await interaction.guild.members.fetch();

                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Organigramme Complet - Mairie Noctra')
                    .setDescription('Voici l\'arborescence officielle de la Mairie avec les membres en poste et leurs salaires :')
                    .setColor(0x0A1128)
                    .setTimestamp();

                // Boucle pour parcourir chaque poste de la hiérarchie
                for (const poste of HIERARCHIE_LISTE) {
                    const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(poste.roleId));

                    let membresList = '_Aucun membre_';
                    if (membersWithRole.size > 0) {
                        membresList = membersWithRole.map(m => `• ${m.user} (${m.displayName})`).join('\n');
                    }

                    embed.addFields({
                        name: `🔹 ${poste.name} — 💰 ${poste.salaire}`,
                        value: membresList,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Erreur lors de la génération de l\'organigramme :', error);
                await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération des rôles.' });
            }
        }
    } 

    // --- CAS B : L'UTILISATEUR CLIQUE SUR UN BOUTON (ACCEPTER / REFUSER) ---
    else if (interaction.isButton()) {
        // Sécurité : Seul le Maire (possédant le rôle MAIRE_ROLE_ID) peut cliquer sur ces boutons
        if (!interaction.member.roles.cache.has(MAIRE_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ Seul le **Maire** est habilité à accepter ou refuser les demandes.', 
                ephemeral: true 
            });
        }

        // Extraction de l'action ('accept' ou 'refuse') et de l'ID de l'auteur de la demande
        const [action, authorId] = interaction.customId.split('_'); 

        if (action === 'accept' || action === 'refuse') {
            const modalId = `modalDecision_${action}_${authorId}`;
            const modal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(action === 'accept' ? 'Valider la demande' : 'Refuser la demande');

            // Champ texte demandant le motif ou commentaire de la décision au Maire
            const motifInput = new TextInputBuilder()
                .setCustomId('decisionMotif')
                .setLabel('Commentaire / Motif de la décision')
                .setPlaceholder(action === 'accept' ? 'Ex: Validé par la Mairie.' : 'Ex: Motifs insuffisants...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(motifInput));
            await interaction.showModal(modal);
        }
    }

    // --- CAS C : L'UTILISATEUR SOUMET UN FORMULAIRE (MODAL) ---
    else if (interaction.isModalSubmit()) {
        
        // 1. Soumission de la décision du Maire (Validation ou Refus d'un mandat/demande)
        if (interaction.customId.startsWith('modalDecision_')) {
            const [, action, authorId] = interaction.customId.split('_');
            const motif = interaction.fields.getTextInputValue('decisionMotif');

            await interaction.deferReply({ ephemeral: true });

            try {
                const targetUser = await client.users.fetch(authorId); // Récupère l'auteur initial de la demande
                const originalEmbed = interaction.message.embeds[0];
                const maireDisplayName = interaction.member.displayName; // Nom d'affichage actuel du Maire

                // Supprime l'ancien champ "Statut" s'il existait pour éviter les doublons
                const filteredFields = originalEmbed.fields.filter(f => f.name !== 'Statut');

                // Crée l'embed mis à jour avec le nouveau statut, le motif et le nom du maire
                const updatedEmbed = new EmbedBuilder()
                    .setTitle(originalEmbed.title)
                    .setColor(action === 'accept' ? 0x2ECC71 : 0xE74C3C) // Vert si accepté, Rouge si refusé
                    .addFields(filteredFields)
                    .addFields(
                        { name: 'Statut', value: action === 'accept' ? '✅ **Accepté**' : '❌ **Refusé**', inline: false },
                        { name: 'Commentaire de la Mairie', value: motif, inline: false },
                        { name: 'Traité par', value: maireDisplayName, inline: false }
                    );

                // Si le message d'origine contenait une image (cachet), on la préserve
                if (originalEmbed.image) {
                    updatedEmbed.setImage('attachment://cachet.png');
                    const cachetAttachment = new AttachmentBuilder('./images/cachet_mairie.png', { name: 'cachet.png' });
                    await interaction.message.edit({ embeds: [updatedEmbed], files: [cachetAttachment], components: [] });
                } else {
                    await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
                }

                // Envoi d'un Message Privé (DM) à l'auteur de la demande pour l'informer de la décision
                if (targetUser) {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle(action === 'accept' ? '✅ Votre demande a été acceptée !' : '❌ Votre demande a été refusée.')
                        .setColor(action === 'accept' ? 0x2ECC71 : 0xE74C3C)
                        .setDescription(`Concernant votre dossier (**${originalEmbed.fields[0].value}**)`)
                        .addFields(
                            { name: 'Motif / Commentaire', value: motif, inline: false },
                            { name: 'Traité par', value: maireDisplayName, inline: false }
                        )
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                        console.log("Impossible d'envoyer un MP à l'utilisateur.");
                    });
                }

                await interaction.editReply({ content: '✅ La décision a bien été enregistrée et le demandeur a été notifié en MP.' });
            } catch (error) {
                console.error('Erreur lors du traitement de la décision :', error);
                await interaction.editReply({ content: '❌ Une erreur est survenue lors de la transmission de la réponse.' });
            }
        }

        // 2. Soumission d'une nouvelle demande de mandat
        else if (interaction.customId === 'modalMandat') {
            const categorie = interaction.fields.getTextInputValue('mandatCategorie');
            const description = interaction.fields.getTextInputValue('mandatDescription');
            const echeance = interaction.fields.getTextInputValue('mandatEcheance');
            const signature = interaction.fields.getTextInputValue('mandatSignature');

            const cachetAttachment = new AttachmentBuilder('./images/cachet_mairie.png', { name: 'cachet.png' });

            const embed = new EmbedBuilder()
                .setTitle('⚖️ Nouvelle Demande de Mandat - Mairie Noctra')
                .setColor(0xF1C40F) // Jaune / Orange (en attente)
                .addFields(
                    { name: 'Catégorie', value: categorie, inline: true },
                    { name: 'Pour le', value: echeance, inline: true },
                    { name: 'Description', value: description },
                    { name: 'Demandeur / Signature', value: `**${signature}** (${interaction.user})`, inline: false }
                )
                .setImage('attachment://cachet.png')
                .setTimestamp()
                .setFooter({ text: `Demandé par ${interaction.user.tag}` });

            // Création des boutons "Accepter" et "Refuser" associés à l'ID de l'auteur
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_${interaction.user.id}`)
                    .setLabel('Accepter')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`refuse_${interaction.user.id}`)
                    .setLabel('Refuser')
                    .setStyle(ButtonStyle.Danger)
            );

            // Envoi de l'embed et des boutons dans le salon des mandats configuré
            if (SALON_MANDAT_ID) {
                try {
                    const salon = await client.channels.fetch(SALON_MANDAT_ID);
                    if (salon) {
                        await salon.send({ embeds: [embed], files: [cachetAttachment], components: [row] });
                    }
                } catch (err) {
                    console.error('Erreur d\'envoi dans le salon mandat :', err);
                }
            }

            await interaction.reply({ 
                content: '✅ Votre demande de mandat a bien été transmise aux services de la Mairie.', 
                ephemeral: true 
            });
        } 

        // 3. Soumission d'une nouvelle demande administrative
        else if (interaction.customId === 'modalAdministrative') {
            const typeDemande = interaction.fields.getTextInputValue('adminType');
            const details = interaction.fields.getTextInputValue('adminDetails');
            const identite = interaction.fields.getTextInputValue('adminIdentite');

            const embed = new EmbedBuilder()
                .setTitle('📋 Nouvelle Demande Administrative')
                .setColor(0x3498DB) // Bleu
                .addFields(
                    { name: 'Objet', value: typeDemande, inline: true },
                    { name: 'Détails', value: details, inline: false },
                    { name: 'Demandeur', value: `**${identite}** (${interaction.user})`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Soumis par ${interaction.user.tag}` });

            // Boutons de validation/refus pour la demande administrative
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_${interaction.user.id}`)
                    .setLabel('Accepter')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`refuse_${interaction.user.id}`)
                    .setLabel('Refuser')
                    .setStyle(ButtonStyle.Danger)
            );

            // Envoi dans le salon administratif dédié
            if (SALON_ADMINISTRATIF_ID) {
                try {
                    const salon = await client.channels.fetch(SALON_ADMINISTRATIF_ID);
                    if (salon) {
                        await salon.send({ embeds: [embed], components: [row] });
                    }
                } catch (err) {
                    console.error('Erreur d\'envoi de la demande administrative :', err);
                }
            }

            await interaction.reply({ 
                content: '✅ Votre demande administrative a bien été envoyée dans le salon dédié.', 
                ephemeral: true 
            });
        }
    }
});

// ==========================================
// 5. MINI SERVEUR HTTP POUR SATISFAIRE RENDER (GRATUIT)
// ==========================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Mairie actif et en ligne !\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur HTTP de validation Render en écoute sur le port ${PORT}`);
});

// ==========================================
// 6. CONNEXION DU BOT À DISCORD
// ==========================================
client.login(process.env.DISCORD_TOKEN);