"""Test run: navigate to schedule, save captcha image, wait for it to be read, then enter it."""
from playwright.sync_api import sync_playwright
import time
import os
import base64
import re

os.makedirs("logs", exist_ok=True)

PASSPORT = "AB1234567"
VISA = "QA9876543"
COUNTRY = "Pakistan"

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
    )
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 800},
    )
    page = context.new_page()

    # Step 1: Navigate
    print("1. Navigating to site...")
    page.goto("https://www.qatarvisacenter.com/", wait_until="networkidle", timeout=60000)
    time.sleep(2)

    # Step 2: Select English
    print("2. Selecting English...")
    page.locator("input.dropdown-toggle").first.click()
    time.sleep(1)
    page.locator("ul.dropdown-menu a", has_text="English").first.click()
    time.sleep(2)

    # Step 3: Select Pakistan
    print("3. Selecting Pakistan...")
    page.locator("input.dropdown-toggle").nth(1).click()
    time.sleep(1)
    page.locator("ul.dropdown-menu a", has_text=COUNTRY).click()
    page.wait_for_url("**/home**", timeout=60000)
    time.sleep(2)

    # Step 4: Click Book Appointment
    print("4. Clicking Book Appointment...")
    page.locator("a.card-box", has_text="BOOK APPOINTMENT").click()
    page.wait_for_url("**/schedule**", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    time.sleep(2)

    # Step 5: Dismiss notification modal
    print("5. Dismissing notification modal...")
    try:
        ok_btn = page.locator("#attentionPopup button.cir-em-btn")
        if ok_btn.is_visible(timeout=5000):
            ok_btn.click()
            time.sleep(1)
            print("   Modal dismissed.")
    except:
        print("   No modal found.")

    # Step 6: Fill credentials
    print("6. Filling passport and visa...")
    page.locator("input[placeholder='Passport Number']").fill(PASSPORT)
    page.locator("input[placeholder='Visa Number']").fill(VISA)
    time.sleep(1)

    # Step 7: Save captcha image
    print("7. Saving captcha image...")
    captcha_src = page.locator("#captchaImage").get_attribute("src")
    if captcha_src and captcha_src.startswith("data:image"):
        # Extract base64 data
        b64_data = captcha_src.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        with open("logs/captcha.png", "wb") as f:
            f.write(img_bytes)
        print("   Captcha saved to logs/captcha.png")
    else:
        page.locator("#captchaImage").screenshot(path="logs/captcha.png")
        print("   Captcha screenshot saved to logs/captcha.png")

    # Step 8: Write a signal file - wait for captcha_answer.txt to appear
    print("8. Waiting for captcha answer in logs/captcha_answer.txt ...")
    # Remove old answer file if exists
    try:
        os.remove("logs/captcha_answer.txt")
    except FileNotFoundError:
        pass

    for i in range(300):  # wait up to 5 min
        if os.path.exists("logs/captcha_answer.txt"):
            with open("logs/captcha_answer.txt", "r") as f:
                answer = f.read().strip()
            if answer:
                print(f"   Got captcha answer: {answer}")
                break
        time.sleep(1)
    else:
        print("   Timeout waiting for captcha answer!")
        browser.close()
        exit(1)

    # Step 9: Enter captcha
    print("9. Entering captcha...")
    page.locator("input[name='captcha']").fill(answer)
    time.sleep(1)

    # Step 10: Click Submit
    print("10. Clicking Submit...")
    submit_btn = page.locator("button.btn-brand-arrow", has_text="Submit")
    # Wait for button to be enabled
    for _ in range(15):
        if not submit_btn.is_disabled():
            break
        time.sleep(1)
    submit_btn.click()
    page.wait_for_load_state("networkidle", timeout=60000)
    time.sleep(3)

    # Step 11: Screenshot result
    page.screenshot(path="logs/result.png", full_page=True)
    print("11. Result screenshot saved to logs/result.png")
    print(f"    URL: {page.url}")

    time.sleep(3)
    browser.close()
    print("\nDone!")
