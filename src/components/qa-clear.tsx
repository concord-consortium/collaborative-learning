import React, { useEffect, useState } from "react";
import { clearFirebaseAnonQAUser } from "../lib/db-clear";

export const QAClear: React.FC = () => {
  const [qaCleared, setQACleared] = useState(false);

  useEffect(() => {
    clearFirebaseAnonQAUser()
      .then(() => setQACleared(true));
  }, []);

  return (
    <span className="qa-clear">
      {qaCleared ? `QA Cleared: OK` : "QA Clearing..."}
    </span>
  );
};

