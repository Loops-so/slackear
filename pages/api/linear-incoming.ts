// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { LinearClient } from "@linear/sdk";

// Api key authentication
const linear = new LinearClient({
  apiKey: process.env.LINEAR_KEY,
});

type Data = {
  name: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const isUpdate = req.body.action === "update";
  const isComplete = req.body.data.state.type === "completed";
  const wasPreviouslyNotComplete = req.body.updatedFrom.completedAt === null;

  if (!(isUpdate && isComplete && wasPreviouslyNotComplete)) {
    res.status(200).end();
    return;
  }
  const issueId = req.body.data.id;
  // todo - is there a way to filter issues by parent
  const issues = await linear.issues({
    filter: {
      id: { eq: issueId },
    },
  });
  const issue = issues.nodes[0];
  const issueChildren = await issue.children({
    filter: {
      state: {
        type: { neq: "completed" },
      },
    },
  });
  const slackWebhook = process.env.SLACK_WEBHOOK;
  if (slackWebhook && issueChildren.nodes.length) {
    const elements = [];
    for (let index = 0; index < issueChildren.nodes.length; index++) {
      const element = issueChildren.nodes[index];
      elements.push({
        type: "button",
        text: {
          type: "plain_text",
          text: element.title,
          emoji: true,
        },
        value: element.identifier,
        url: `https://linear.app/loops/issue/${element.identifier}`,
      });
    }

    const payload = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*<https://linear.app/loops/issue/${issue.identifier}|${issue.title}> - Closed*\nThese children need follow up:\n`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "actions",
          elements,
        },
      ],
    };
    const response = await fetch(slackWebhook, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  res.status(200).end();
  return;
}
