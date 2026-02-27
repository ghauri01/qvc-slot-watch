import base64
import logging
import os
import time
from playwright.sync_api import sync_playwright, Page, TimeoutError as PwTimeout

import config

log = logging.getLogger(__name__)

NAVIGATION_TIMEOUT = 60_000  # ms
ACTION_TIMEOUT = 15_000      # ms


def _dismiss_notification_modal(page: Page, timeout: int = 3_000) -> bool:
    """Close any modal popup (Notification/Attention/session clear). Returns True if dismissed."""
    for selector in [
        "#invalidOldToken button:has-text('OK')",
        "#passportValidate button:has-text('OK')",
        "#attentionPopup button.cir-em-btn",
        ".modal.fade.in button:has-text('OK')",
        ".modal.fade.in button:has-text('ok')",
        "button:has-text('OK')",
        "#attentionPopup .btn.position-absolute",
        "button[data-bs-dismiss='modal']",
    ]:
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=timeout):
                btn.click()
                time.sleep(2)
                log.info("Dismissed modal via: %s", selector)
                return True
        except (PwTimeout, Exception):
            continue
    return False


def _select_language(page: Page) -> None:
    """Select English from the language dropdown on the landing page."""
    log.info("Selecting language: English")
    # The first input.dropdown-toggle is the language selector
    page.locator("input.dropdown-toggle").first.click()
    time.sleep(1)
    page.locator("ul.dropdown-menu a", has_text="English").first.click()
    time.sleep(2)
    log.info("Language selected: English")


def _select_country(page: Page) -> None:
    """Select the country of residence from the dropdown on the landing page."""
    log.info("Selecting country: %s", config.COUNTRY_OF_RESIDENCE)
    # The second input.dropdown-toggle is the country selector (appears after language)
    country_input = page.locator("input.dropdown-toggle").nth(1)
    country_input.wait_for(state="visible", timeout=ACTION_TIMEOUT)
    country_input.click()
    time.sleep(1)
    page.locator("ul.dropdown-menu a", has_text=config.COUNTRY_OF_RESIDENCE).click()
    # This triggers navigation to /home
    page.wait_for_url("**/home**", timeout=NAVIGATION_TIMEOUT)
    time.sleep(2)
    log.info("Country selected, navigated to /home")


def _click_book_appointment(page: Page) -> None:
    """Click the 'BOOK APPOINTMENT' card on the home page."""
    log.info("Clicking 'Book Appointment'")
    page.locator("a.card-box", has_text="BOOK APPOINTMENT").click()
    page.wait_for_url("**/schedule**", timeout=NAVIGATION_TIMEOUT)
    page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT)
    time.sleep(2)
    log.info("Navigated to /schedule")


def _fill_credentials(page: Page) -> None:
    """Fill in passport number and visa number on the schedule page."""
    log.info("Filling credentials")

    passport_input = page.locator("input[placeholder='Passport Number']")
    passport_input.wait_for(state="visible", timeout=ACTION_TIMEOUT)
    passport_input.fill(config.PASSPORT_NUMBER)
    log.debug("Filled passport number")

    visa_input = page.locator("input[placeholder='Visa Number']")
    visa_input.wait_for(state="visible", timeout=ACTION_TIMEOUT)
    visa_input.fill(config.VISA_NUMBER)
    log.debug("Filled visa number")


def _solve_captcha_ocr(image_bytes: bytes) -> str:
    """Try to solve captcha using ddddocr (purpose-built captcha OCR)."""
    try:
        import ddddocr
        ocr = ddddocr.DdddOcr(show_ad=False)
        result = ocr.classification(image_bytes)
        return result.strip()
    except Exception as e:
        log.warning("OCR failed: %s", e)
        return ""


def _extract_captcha_image(page: Page) -> bytes:
    """Extract captcha image bytes from the page."""
    captcha_img = page.locator("#captchaImage")
    captcha_src = captcha_img.get_attribute("src")
    if captcha_src and captcha_src.startswith("data:image"):
        b64_data = captcha_src.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
    else:
        captcha_img.screenshot(path="logs/captcha.png")
        with open("logs/captcha.png", "rb") as f:
            img_bytes = f.read()

    with open("logs/captcha.png", "wb") as f:
        f.write(img_bytes)
    return img_bytes


def _refresh_captcha(page: Page) -> None:
    """Click the captcha refresh button to get a new captcha image."""
    for selector in [
        "#captchaImage + *",         # element right after captcha image
        "img[src*='refresh']",
        "button:near(#captchaImage)",
        "a:near(#captchaImage)",
        "i.fa-refresh",
        ".captcha-refresh",
        "#captchaImage ~ *",         # sibling after captcha
    ]:
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=2_000):
                btn.click()
                time.sleep(2)
                log.info("Refreshed captcha image")
                return
        except Exception:
            continue
    log.warning("Could not find captcha refresh button")


def _handle_captcha_and_submit(page: Page) -> bool:
    """Solve captcha with OCR, submit, and retry on failure. Returns True if form was accepted."""
    MAX_RETRIES = 5

    captcha_img = page.locator("#captchaImage")
    captcha_input = page.locator("input[name='captcha']")

    try:
        if not captcha_img.is_visible(timeout=5_000):
            log.info("No captcha image found — skipping captcha step")
            return True
    except PwTimeout:
        log.info("No captcha found — skipping")
        return True

    for attempt in range(1, MAX_RETRIES + 1):
        log.info("Captcha attempt %d/%d", attempt, MAX_RETRIES)

        # Extract and solve
        img_bytes = _extract_captcha_image(page)
        answer = _solve_captcha_ocr(img_bytes)

        if not answer:
            log.warning("OCR returned empty — refreshing captcha")
            _refresh_captcha(page)
            continue

        log.info("OCR solved captcha: %s", answer)
        captcha_input.fill(answer)
        time.sleep(1)

        # Dismiss any modal popup before clicking Submit
        _dismiss_notification_modal(page, timeout=2_000)

        # Click Submit
        submit_btn = page.locator("button.btn-brand-arrow", has_text="Submit")
        try:
            submit_btn.wait_for(state="visible", timeout=ACTION_TIMEOUT)
            for _ in range(30):
                if not submit_btn.is_disabled():
                    break
                time.sleep(1)
            submit_btn.click()
            page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT)
            time.sleep(3)
        except Exception as e:
            log.warning("Submit click failed: %s", e)
            # Try dismissing modal that might be blocking
            _dismiss_notification_modal(page, timeout=3_000)
            time.sleep(2)
            continue

        # Dismiss "clear active session" popup if it appears
        _dismiss_notification_modal(page, timeout=5_000)
        time.sleep(2)

        # Check if captcha was rejected
        try:
            error_el = page.locator("text=Please enter valid Captcha").first
            if error_el.is_visible(timeout=3_000):
                log.warning("Captcha rejected — refreshing and retrying")
                _refresh_captcha(page)
                captcha_input.fill("")
                time.sleep(1)
                continue
        except (PwTimeout, Exception):
            pass

        # If still on the same page with captcha visible, it likely failed
        try:
            if captcha_img.is_visible(timeout=2_000):
                # Check if page URL changed (navigated away from schedule)
                if "/schedule" in page.url:
                    log.warning("Still on schedule page — captcha likely wrong, retrying")
                    _refresh_captcha(page)
                    captcha_input.fill("")
                    time.sleep(1)
                    continue
        except Exception:
            pass

        log.info("Form submitted successfully")
        return True

    log.error("All %d captcha attempts failed", MAX_RETRIES)
    return False


def _fill_applicant_details(page: Page) -> None:
    """Fill in mobile number and email on the Applicant Details page, then confirm."""
    log.info("Filling applicant details (mobile + email)")

    # Wait for the Applicant Details page to load
    try:
        page.locator("text=Applicant Details").first.wait_for(
            state="visible", timeout=NAVIGATION_TIMEOUT
        )
    except PwTimeout:
        log.warning("Applicant Details page not detected — skipping")
        return

    time.sleep(2)

    # Format mobile number: site expects "00" prefix, not "+"
    mobile = config.MOBILE_NUMBER
    if mobile.startswith("+"):
        mobile = "00" + mobile[1:]
    log.info("Using mobile number: %s", mobile)

    # Find and fill fields by label proximity (Angular forms don't use standard attrs)
    # Get all visible input fields on the page
    all_inputs = page.locator("input.form-control, input[type='text'], input[type='email']").all()
    filled_mobile = 0
    filled_email = 0

    for inp in all_inputs:
        try:
            if not inp.is_visible(timeout=1_000):
                continue
            # Check what label is near this input
            parent = inp.locator("..")
            parent_text = parent.inner_text(timeout=1_000).strip().lower()

            if "mobile" in parent_text and not inp.input_value(timeout=1_000):
                inp.fill(mobile)
                filled_mobile += 1
                log.info("Filled mobile field #%d", filled_mobile)
            elif "email" in parent_text and not inp.input_value(timeout=1_000):
                inp.fill(config.EMAIL_ADDRESS)
                filled_email += 1
                log.info("Filled email field #%d", filled_email)
        except Exception:
            continue

    # Fallback: try by label text if nothing was filled
    if filled_mobile == 0:
        for label in page.locator("label:has-text('Mobile')").all():
            try:
                inp = label.locator(".. >> input").first
                if inp.is_visible(timeout=1_000) and not inp.input_value(timeout=1_000):
                    inp.fill(mobile)
                    filled_mobile += 1
                    log.info("Filled mobile field (by label)")
            except Exception:
                continue

    if filled_email == 0:
        for label in page.locator("label:has-text('Email')").all():
            try:
                inp = label.locator(".. >> input").first
                if inp.is_visible(timeout=1_000) and not inp.input_value(timeout=1_000):
                    inp.fill(config.EMAIL_ADDRESS)
                    filled_email += 1
                    log.info("Filled email field (by label)")
            except Exception:
                continue

    log.info("Filled %d mobile and %d email fields", filled_mobile, filled_email)

    time.sleep(1)
    page.screenshot(path="logs/applicant_details_filled.png")
    log.info("Applicant details screenshot saved")

    # Click "I confirm that the details above are accurate..." button
    for selector in [
        "button:has-text('I confirm')",
        "button:has-text('confirm that the details')",
        "a:has-text('I confirm')",
        ".btn:has-text('confirm')",
    ]:
        try:
            confirm_btn = page.locator(selector).first
            if confirm_btn.is_visible(timeout=5_000):
                confirm_btn.click()
                log.info("Clicked confirm button")
                page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT)
                time.sleep(3)
                return
        except (PwTimeout, Exception):
            continue

    log.warning("Could not find confirm button — continuing anyway")


def _click_submit(page: Page) -> None:
    """Click the Submit button on the schedule form."""
    log.info("Clicking Submit")
    submit_btn = page.locator("button.btn-brand-arrow", has_text="Submit")
    submit_btn.wait_for(state="visible", timeout=ACTION_TIMEOUT)

    # Wait until the button is enabled (not disabled)
    for _ in range(30):
        if not submit_btn.is_disabled():
            break
        time.sleep(1)
    else:
        log.warning("Submit button still disabled after 30s — clicking anyway")

    submit_btn.click()
    page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT)
    time.sleep(3)
    log.info("Form submitted")


def _select_qvc_center(page: Page) -> None:
    """Select the QVC Center from the custom dropdown on the calendar page.

    The dropdown is: <button name="selectedVsc"> inside <div class="dropdown">,
    with options in <ul class="dropdown-menu"> as <li> items.
    """
    log.info("Selecting QVC center: %s", config.QVC_LOCATION)

    try:
        # Click the dropdown button to reveal the options list
        dropdown_btn = page.locator("button[name='selectedVsc']")
        dropdown_btn.wait_for(state="visible", timeout=ACTION_TIMEOUT)
        dropdown_btn.click()
        time.sleep(1)

        # Click the matching option inside the dropdown menu
        # Use the <ul> sibling of the button to avoid matching banner text
        option = page.locator(
            "button[name='selectedVsc'] ~ ul.dropdown-menu li",
            has_text=config.QVC_LOCATION,
        ).first
        option.wait_for(state="visible", timeout=5_000)
        option.click()
        time.sleep(3)
        log.info("Selected QVC center: %s", config.QVC_LOCATION)
        return
    except (PwTimeout, Exception) as e:
        log.warning("Primary dropdown approach failed: %s", e)

    # Fallback: click anything with "Select Center" text, then pick from revealed list
    try:
        page.locator("button:has-text('Select Center')").first.click()
        time.sleep(1)
        page.locator("ul.dropdown-menu li", has_text=config.QVC_LOCATION).last.click()
        time.sleep(3)
        log.info("Selected QVC center (fallback): %s", config.QVC_LOCATION)
        return
    except (PwTimeout, Exception) as e:
        log.warning("Fallback dropdown approach failed: %s", e)

    log.warning("Could not find or select QVC center dropdown")


def _get_calendar_month(page: Page) -> str:
    """Get the current month/year shown on the calendar."""
    try:
        header = page.locator("text=February, text=March, text=April, text=May, text=June, text=July, text=August, text=September, text=October, text=November, text=December, text=January").first
        return header.inner_text(timeout=2_000).strip()
    except Exception:
        return "unknown"


def _scrape_month_slots(page: Page) -> list[dict]:
    """Scrape available dates from the currently visible calendar month."""
    slots: list[dict] = []

    # Get month header for context
    month_text = ""
    try:
        # Look for the month/year header near the calendar navigation
        for sel in [
            "th.month",
            ".datepicker-switch",
            "button.current",
        ]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2_000):
                    month_text = el.inner_text(timeout=2_000).strip()
                    break
            except Exception:
                continue
        if not month_text:
            # Try broader search for month text near calendar arrows
            cal_area = page.locator("text=/\\w+ \\d{4}/").first
            month_text = cal_area.inner_text(timeout=2_000).strip()
    except Exception:
        month_text = "current month"

    log.info("Checking calendar: %s", month_text)

    # Look for available (clickable, non-disabled) date cells
    available_selectors = [
        "td.available",
        "td:not(.disabled):not(.unavailable):not(.off) a",
        "td.day:not(.disabled):not(.off)",
        ".day:not(.disabled):not(.off)",
        "td[class*='available' i]",
        "a[class*='available' i]",
    ]

    for selector in available_selectors:
        try:
            elements = page.locator(selector).all()
            for el in elements:
                try:
                    text = el.inner_text(timeout=2_000).strip()
                    if text and text.isdigit():
                        slots.append({
                            "date": f"{text} {month_text}",
                            "time": "",
                            "location": config.QVC_LOCATION,
                        })
                except Exception:
                    continue
            if slots:
                break
        except Exception:
            continue

    return slots


def _scrape_calendar(page: Page) -> list[dict]:
    """Select QVC center, then scrape multiple months of calendar for availability."""
    all_slots: list[dict] = []
    MONTHS_TO_CHECK = 3

    # Take initial screenshot
    try:
        page.screenshot(path="logs/calendar_page.png", full_page=True)
        log.info("Calendar page screenshot saved to logs/calendar_page.png")
    except Exception:
        pass

    # Check for error messages
    for sel in [".modal.fade.in .modal-body", ".alert-danger", ".error-message"]:
        try:
            err = page.locator(sel).first
            if err.is_visible(timeout=3_000):
                err_text = err.inner_text(timeout=2_000).strip()
                if err_text:
                    log.warning("Page shows message: %s", err_text[:200])
        except (PwTimeout, Exception):
            pass

    # Select QVC Center from dropdown
    _select_qvc_center(page)

    # Check current month + next N months
    for month_idx in range(MONTHS_TO_CHECK):
        slots = _scrape_month_slots(page)
        all_slots.extend(slots)

        if slots:
            log.info("Found %d available date(s) in month %d", len(slots), month_idx + 1)

        # Click right arrow (">") to go to next month
        if month_idx < MONTHS_TO_CHECK - 1:
            next_clicked = False
            for selector in [
                "button:has-text('>')",
                "a:has-text('>')",
                ".next",
                "th.next",
                "button.next",
                "[aria-label='Next']",
                ".datepicker .next",
                ".fa-chevron-right",
                ".fa-angle-right",
            ]:
                try:
                    btn = page.locator(selector).first
                    if btn.is_visible(timeout=3_000):
                        btn.click()
                        time.sleep(2)
                        next_clicked = True
                        log.info("Navigated to next month")
                        break
                except Exception:
                    continue

            if not next_clicked:
                log.warning("Could not find next month button — stopping")
                break

    # Take final screenshot
    try:
        page.screenshot(path="logs/calendar_final.png", full_page=True)
    except Exception:
        pass

    # Deduplicate
    seen = set()
    unique: list[dict] = []
    for s in all_slots:
        key = s["date"]
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return unique


def _launch_browser(pw):
    """Launch browser with optional extension support.

    When EXTENSION_PATH is set, uses a persistent context (required for extensions).
    Otherwise, uses the standard launch + new_context approach.

    Returns (context_or_browser, page, is_persistent).
    """
    chrome_args = ["--disable-blink-features=AutomationControlled"]
    ext_path = config.EXTENSION_PATH

    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    if ext_path and os.path.isdir(ext_path):
        # Persistent context is required to load Chrome extensions
        log.info("Loading extension from: %s", ext_path)
        chrome_args += [
            f"--disable-extensions-except={ext_path}",
            f"--load-extension={ext_path}",
        ]
        context = pw.chromium.launch_persistent_context(
            user_data_dir="",  # empty string = temp profile
            headless=False,    # extensions don't work in headless mode
            args=chrome_args,
            user_agent=ua,
            viewport={"width": 1280, "height": 800},
        )
        # Auto-grant notification permission so the "Allow" bar never appears
        context.grant_permissions(["notifications"])
        log.info("Notification permission granted automatically")
        page = context.pages[0] if context.pages else context.new_page()
        return context, page, True
    else:
        if ext_path:
            log.warning("EXTENSION_PATH '%s' not found — launching without extension", ext_path)
        browser = pw.chromium.launch(
            headless=config.HEADLESS,
            args=chrome_args,
        )
        context = browser.new_context(
            user_agent=ua,
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        return browser, page, False


def _start_extension_monitor(page: Page) -> None:
    """Trigger the browser extension to start monitoring on the calendar page."""
    if not config.EXTENSION_PATH or not os.path.isdir(config.EXTENSION_PATH):
        return
    log.info("Triggering extension auto-start on calendar page")
    try:
        page.evaluate("window.dispatchEvent(new CustomEvent('qvc-auto-start'))")
        time.sleep(2)
        log.info("Extension monitoring started via auto-start trigger")
    except Exception as e:
        log.warning("Could not trigger extension auto-start: %s", e)


def check_appointments() -> list[dict]:
    """Run the full booking flow and return available appointment slots."""
    log.info("Starting appointment check (headless=%s)", config.HEADLESS)

    with sync_playwright() as pw:
        handle, page, is_persistent = _launch_browser(pw)
        page.set_default_timeout(ACTION_TIMEOUT)

        try:
            # Step 1: Navigate to landing page
            log.info("Navigating to %s", config.BOOKING_URL)
            page.goto(config.BOOKING_URL, wait_until="networkidle", timeout=NAVIGATION_TIMEOUT)
            time.sleep(2)

            # Step 2: Select language
            _select_language(page)

            # Step 3: Select country
            _select_country(page)

            # Step 4: Click "Book Appointment"
            _click_book_appointment(page)

            # Step 5: Dismiss any notification/attention popup
            _dismiss_notification_modal(page)

            # Step 6: Fill passport + visa number
            _fill_credentials(page)

            # Step 7: Handle captcha + submit (with retry)
            if not _handle_captcha_and_submit(page):
                log.error("Could not pass captcha after retries")
                return []

            # Step 8: Fill applicant details (mobile, email) and confirm
            _dismiss_notification_modal(page)
            _fill_applicant_details(page)

            # Step 9: Scrape results
            _dismiss_notification_modal(page)
            slots = _scrape_calendar(page)
            log.info("Found %d available slot(s)", len(slots))

            # Step 9.5: Auto-start the browser extension monitor
            _start_extension_monitor(page)

            # Step 10: Stay on calendar page for configured duration
            wait_minutes = config.CALENDAR_WAIT_MINUTES
            if wait_minutes > 0:
                log.info("Keeping browser open on calendar page for %d minutes...", wait_minutes)
                page.screenshot(path="logs/calendar_staying_open.png")
                for remaining in range(wait_minutes * 60, 0, -1):
                    time.sleep(1)
                    # Log every minute
                    if remaining % 60 == 0:
                        log.info("  %d minute(s) remaining on calendar page", remaining // 60)
                log.info("Wait complete — closing browser")

            return slots

        except Exception:
            log.error("Error during appointment check", exc_info=True)
            try:
                page.screenshot(path="logs/error_screenshot.png")
                log.info("Error screenshot saved to logs/error_screenshot.png")
            except Exception:
                pass
            return []

        finally:
            handle.close()
