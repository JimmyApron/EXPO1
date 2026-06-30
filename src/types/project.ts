export type Project = {
  id: string;
  userid: string;
  title: string;
  description: string;
  deadline: string | null;
  createdat: string;
  updatedat: string;
};

export type ProjectInput = {
  title: string;
  description: string;
  deadline: string;
};
