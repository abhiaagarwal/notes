---
tags:
  - observations
---

I'm a big fan of 1:1 meetings, especially as a means to close out a sprint and begin planning the next one. Here's the obsidian template I use to record notes from the 1:1s I have with my team members.

````eta
---
date: <% tp.date.now("YYYY-MM-DD") %>
time: <% tp.date.now("HH:mm") %>
team_member:
project: <% tp.file.folder(true).split("/")[1] %>
sprint_num: <% tp.file.folder(true).split("/")[3] %>
type: sprint-checkin
---
# Sprint Check-in

# Chat

## What did you enjoy working on this sprint?

## What didn't you enjoy working on this sprint?

## Are you satisfied with the work you're doing? Is there something else you want to do?

## Do you have any feedback for me? Or how I can better support you?

# Planning

## What did you do last sprint?

## What do you think needs to get done?

# Action items

## Previous Action Items
```dataview
LIST WITHOUT ID
	item.text
FROM
	#sprint-checkin
WHERE
	TRUE AND
	project = this.project AND
	team_member = this.team_member AND
	sprint_num = (this.sprint_num - 1)
FLATTEN
	file.lists AS item
WHERE
	contains(item.section, "Action items")
````

I structure my obsidian vault like `projects/{project}/sprint/{sprint_num}` with each team member's folder living under `check-ins`, so templater pulls out metadata with the path manipulation.

I subscribe to the philosophy of sharing my personal notes back with my teammates. It helps build trust and ensures I'm hearing them the way _they_ want to be heard. Also serves as a convenient reference to them.
