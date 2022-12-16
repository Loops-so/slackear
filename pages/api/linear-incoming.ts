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
  if (issueChildren.nodes.length) {
    issueChildren.nodes.forEach((element) => {
      console.log(`FOLLOW UP REQUIRED for ${element.identifier}`);
    });
  }
  res.status(200).end();
  return;
}
