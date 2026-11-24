package model

// Finding is one evidence-backed result. JSON names must match the Next.js
// ScanResult contract exactly.
type Finding struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Severity string `json:"severity"`
	Verdict  string `json:"verdict"`
	Type     string `json:"type"`
	Evidence string `json:"evidence"`
	Fix      string `json:"fix"`
}

type CheckRun struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Status   string `json:"status"`
	Severity string `json:"severity"`
	Type     string `json:"type"`
}

type ManualCheck struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Why   string `json:"why"`
}

type Context struct {
	FinalURL         string `json:"finalUrl"`
	Status           int    `json:"status"`
	ContentType      string `json:"contentType"`
	BodyScanned      bool   `json:"bodyScanned"`
	Truncated        bool   `json:"truncated"`
	HasForms         bool   `json:"hasForms"`
	HasPasswordForm  bool   `json:"hasPasswordForm"`
	HasPaymentScript bool   `json:"hasPaymentScript"`
	Sensitive        bool   `json:"sensitive"`
	ScriptsScanned   int    `json:"scriptsScanned"`
}

type Counts struct {
	Confirmed       int `json:"confirmed"`
	NeedsValidation int `json:"needs_validation"`
	Rejected        int `json:"rejected"`
	Exposures       int `json:"exposures"`
	Signals         int `json:"signals"`
	Hardening       int `json:"hardening"`
}

type Result struct {
	URL            string        `json:"url"`
	FinalURL       string        `json:"finalUrl"`
	Mode           string        `json:"mode"`
	Score          int           `json:"score"`
	HardeningScore int           `json:"hardeningScore"`
	Coverage       int           `json:"coverage"`
	ChecksRun      int           `json:"checksRun"`
	ChecksTotal    int           `json:"checksTotal"`
	DurationMS     int64         `json:"durationMs"`
	Findings       []Finding     `json:"findings"`
	ManualChecks   []ManualCheck `json:"manualChecks"`
	Notes          []string      `json:"notes"`
	Context        Context       `json:"context"`
	Summary        string        `json:"summary"`
	ReceiptID      string        `json:"receiptId"`
	Checks         []CheckRun    `json:"checks"`
	Counts         Counts        `json:"counts"`
}

// Script is a fetched same-origin JavaScript bundle. It is never serialized.
type Script struct {
	URL       string
	Content   string
	Bytes     int
	Truncated bool
}
