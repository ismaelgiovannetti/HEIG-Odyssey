import { CircleAlert, CircleCheck } from "lucide-react";

type FormAlertProps = {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
};

/**
 * Message accessible utilisé par tous les formulaires. Une erreur emploie le
 * rôle alert, tandis qu'une information non bloquante emploie le rôle status.
 */
export function FormAlert({ tone, children }: FormAlertProps) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  const role = tone === "error" ? "alert" : "status";

  return (
    <div className={`auth-alert auth-alert--${tone}`} role={role} aria-live="polite">
      <Icon aria-hidden="true" size={19} />
      <div>{children}</div>
    </div>
  );
}
