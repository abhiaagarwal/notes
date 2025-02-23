---
title: My scrum workflow
tags:
  - thoughts
---

I recently became a task lead at my company. While I'm thrilled at the opportunity, I also am terrified.

I want my teammates to be succeed. I want to also not trap them in meetings, I think we would all appreciate having more time to do technical things. Most importantly, I want the team to never loose sight of the end goal, generating business value. That's why we get paid the big bucks.

# Sprints

- Looser sort of scrum
  - "Kanban with deadlines"
- No story points
  - I find story points are not a great way to really measure "complexity"
    - Software is complex, and we are not great at measuring said complexity!
  - Creates the wrong incentives in terms of works — I'd rather prioritize devs working at their own pace
  - It's on me, the TL, to make sure things are flowing smoothly
- Standup 2x a week
  - Standups are mostly focused on giving updates, making sure the rest of the team is synced, and making sure everyone is unblocked
  - If a blocker comes up, schedule a meeting after with the relevant parties to unblock
- Longer sprints (3-4 weeks) versus shorter sprints
  - Less meetings overall
  - Probably works bc I work in a matrix model company

## Retros

### 1:1

- I like 1:1 meetings.
  - Once a week is too often, before the end of a sprint is a good way to decompress + aid in sprint planning.
- 2-3 days before retro
- Meeting is max 30 minutes long
- First half (15 minutes):
  - "Personal" stuff
  - General check-in, how are you, how are you satisfied, what can I do to support you and your goals
  - Strictly not about the project
- Second half (15 minutes):
  - "What did you work on"
  - "What needs to get done"
- **Share notes directly with them after the meeting**
  - If you want your colleagues to trust you, then they need to know how you're interpreting things
  - Gives them the opportunity to make corrections
  - When the retro comes, your notes can help them shape their own notes

### Refine scope, asynchronous collaboration

#### Create tickets, preliminary

- Based on convos with team members, create draft "tickets"
  - I'll likely do this inside obsidian via obsidian-projects

#### Meet with PM

- Meet with the PM
- 30 minutes max meeting
- Refine scope, check if everything looks good
- Discuss high-level plans

#### Post retrospective whiteboard publicly, ask for the creation of notes.

- Each team member must create 5 notes in advance
  - Gentle bump 1 hour before retro if not completed
- Ideally: notes are private to everyone _before_ the retro begins
  - Prevent copying of notes
  - Gets honest feedback and discourages herding
    - Is this possible with our current software
- Color-coded notes, each team member gets their own color

#### Actually create the tickets inside of Jira

- Potential: automate it based on the Jira API with a python script?

### Retrospective and planning

- Maximum ONE hour
- While I like icebreakers, I think they can potentially be a huge time sink while artificially extending the length of the meeting
  - So. Don't. The goal is for the retrospective to be "fun" outside of the icebreaker.
- Chit-chat, buffer (5 minutes)
  - Inevitably, it will happen
- Retro (30 minutes)
  - Given the pre-filled notes, spend time grouping them into the various categories (5 minutes)
  - Have each team member talk about their notes (5 minutes)
  - Create a list of action items based on the common themes of the notes (5 minutes)
  - Vote on which ones are more important (5 minutes)
  - Check if we accomplished the action items from last retro (5 minutes)
- Sprint Planning (25 minutes)
  - Go over JIRA board, as a group
  - Make slight modifications as needed
  - If more drastic modifications are needed, hold a follow up meeting with the relevant parties
